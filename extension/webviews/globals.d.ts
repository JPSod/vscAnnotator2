import * as _vscode from "vscode";

declare global {
  const tsvscode: {
    postMessage: ({ type: string, value: any }) => void;
  };
  const apiBaseUrl: string;
  const accessToken: string;
  const nonce: string;

}
