export const DIALOG_PORT = Symbol('DialogPort');

export interface ScenarioInfo {
  id: string;
  title: string;
  description: string;
}

export interface DialogTurnRequest {
  sessionId: string;
  userId: string;
  scenario: string;
  userText: string;
}

export interface DialogPort {
  listScenarios(): Promise<ScenarioInfo[]>;

  streamTurn(
    req: DialogTurnRequest,
    onToken: (token: string) => void,
  ): Promise<string>;
}
