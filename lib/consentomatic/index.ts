import { AutoCMP } from "../types";
import { executeAction, matches } from "../web/consentomatic";

export type DetectorConfig = {
  presentMatcher: {};
  showingMatcher: {};
};
export type MethodConfig = {
  action?: any;
  name: string;
};

export type ConsentOMaticConfig = {
  detectors: DetectorConfig[];
  methods: MethodConfig[];
};

export class ConsentOMaticCMP implements AutoCMP {
  methods = new Map<string, {}>();
  hasSelfTest: boolean;

  constructor(public name: string, public config: ConsentOMaticConfig) {
    config.methods.forEach(methodConfig => {
      if (methodConfig.action) {
        this.methods.set(methodConfig.name, methodConfig.action);
      }
    });
    this.hasSelfTest = false;
  }

  async detectCmp(): Promise<boolean> {
    const matchResults = this.config.detectors.map(detectorConfig =>
      matches(detectorConfig.presentMatcher)
    )
    return matchResults.some(r => !!r);
  }

  async detectPopup(): Promise<boolean> {
    const matchResults = this.config.detectors.map(detectorConfig =>
      matches(detectorConfig.showingMatcher)
    )
    return matchResults.some(r => !!r);
  }

  async executeAction(method: string, param?: any) {
    if (this.methods.has(method)) {
      return executeAction(this.methods.get(method), param);
    }
    return true;
  }

  async optOut(): Promise<boolean> {
    await this.executeAction("HIDE_CMP");
    await this.executeAction("OPEN_OPTIONS");
    await this.executeAction("HIDE_CMP");
    await this.executeAction("DO_CONSENT", []);
    await this.executeAction("SAVE_CONSENT");
    return true;
  }

  async optIn(): Promise<boolean> {
    await this.executeAction("HIDE_CMP");
    await this.executeAction("OPEN_OPTIONS");
    await this.executeAction("HIDE_CMP");
    await this.executeAction("DO_CONSENT", ['D', 'A', 'B', 'E', 'F', 'X']);
    await this.executeAction("SAVE_CONSENT");
    return true;
  }
  async openCmp(): Promise<boolean> {
    await this.executeAction("HIDE_CMP");
    await this.executeAction("OPEN_OPTIONS");
    return true;
  }

  async test(): Promise<boolean> {
    return true;
  }
}
