import fs from "fs";
import path from 'path';
import { test, expect, Page, Frame } from "@playwright/test";
import { waitFor } from "../lib/utils";
import { ContentScriptMessage } from "../lib/messages";
import { enableLogs } from "../lib/config";

const testRegion = (process.env.REGION || "NA").trim();

type TestOptions = {
  testOptOut: boolean;
  testSelfTest: boolean;
  skipRegions?: string[];
};
const defaultOptions: TestOptions = {
  testOptOut: true,
  testSelfTest: true,
  skipRegions: [],
};

const contentScript = fs.readFileSync(
  path.join(__dirname, "../dist/autoconsent.playwright.js"),
  "utf8"
);

export async function injectContentScript(page: Page | Frame) {
  try {
    await page.evaluate(contentScript);
  } catch (e) {
    // frame was detached
    // console.log(e);
  }
}

export function generateTest(
  url: string,
  expectedCmp: string,
  options: TestOptions = { testOptOut: true, testSelfTest: true }
) {
  test(`${url.split("://")[1]} .${testRegion}`, async ({ page }) => {
    if (options.skipRegions && options.skipRegions.indexOf(testRegion) !== -1) {
      test.skip();
    }
    await page.goto(url, { waitUntil: "commit" });

    // set up a messaging function
    const received: ContentScriptMessage[] = [];

    function isMessageReceived(msg: Partial<ContentScriptMessage>, partial = true) {
      return received.some((m) => {
        const keysMatch = partial || Object.keys(m).length === Object.keys(msg).length;
        return keysMatch && Object.keys(msg).every(
          (k) => (<any>m)[k] === (<any>msg)[k]
        );
      });
    }

    let hasSelfTest = false;
    async function messageCallback({ frame }: { frame: Frame }, msg: ContentScriptMessage) {
      enableLogs && console.log(msg);
      received.push(msg);
      if (msg.type === 'autoconsentDone' && msg.hasSelfTest && options.testSelfTest) {
        hasSelfTest = true;
        await frame.evaluate(`autoconsentReceiveMessage({ type: "selfTest" })`);
      } else if (msg.type === 'eval') {
        const result = await frame.evaluate(msg.code);
        await frame.evaluate(`autoconsentReceiveMessage({ id: "${msg.id}", type: "evalResp", result: ${JSON.stringify(result)} })`);
      }
    }
    await page.exposeBinding("autoconsentSendMessage", messageCallback);

    // inject content scripts into every frame
    await injectContentScript(page);
    page.frames().forEach(injectContentScript);
    page.on("framenavigated", injectContentScript);

    // wait for all messages and assertions
    await waitFor(() => isMessageReceived({ type: "popupFound", cmp: expectedCmp }), 50, 500);
    expect(isMessageReceived({ type: "popupFound", cmp: expectedCmp })).toBe(true);

    if (options.testOptOut) {
      await waitFor(() => isMessageReceived({ type: "optOutResult", result: true }), 50, 500);
      expect(isMessageReceived({ type: "optOutResult", result: true })).toBe(true);
    }
    if (options.testSelfTest && hasSelfTest) {
      await waitFor(() => isMessageReceived({ type: "selfTestResult", result: true }), 50, 500);
      expect(isMessageReceived({ type: "selfTestResult", result: true })).toBe(true);
    }
  });
}

export default function generateCMPTests(
  cmp: string,
  sites: string[],
  options: Partial<TestOptions> = {}
) {
  test.describe(cmp, () => {
    sites.forEach((url) => {
      generateTest(url, cmp, Object.assign({}, defaultOptions, options));
    });
  });
}