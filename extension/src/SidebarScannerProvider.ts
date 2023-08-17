import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import { apiBaseUrl } from "./constants";
import { TokenManager } from "./tokenManager";
import { authenticate } from "./authenticate";

async function callScanFileCommand(standardId: number, accessToken: string) {
  try {
      await vscode.commands.executeCommand('vscribe.scanFile', [standardId, accessToken] );
  } catch (error) {
      console.error('Failed to execute the scanFile command:', error);
  }
}

async function callEditStandardsCommand(accessToken: string) {
  try {
      await vscode.commands.executeCommand('vscribe.editStandards', accessToken);
  } catch (error) {
      console.error('Failed to execute the scanFile command:', error);
  }
}

export class SidebarScannerProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "onInfo": {
          if (!data.value) {
            return;
          }
          vscode.window.showInformationMessage(data.value);
          break;
        }
        case "onError": {
          if (!data.value) {
            return;
          }
          vscode.window.showErrorMessage(data.value);
          break;
        }
        case "onScan": {
          await callScanFileCommand(data.standardId, data.accessToken);
          break;
        }
        case "editStandards": {
          await callEditStandardsCommand(data.accessToken);
          break;
        }
        case "get-token": {
          webviewView.webview.postMessage({
            type: 'token', 
            value: TokenManager.getToken()});
          break;
        }
        case "login": {
          authenticate(() => {
            webviewView.webview.postMessage({
              type: 'token', 
              value: TokenManager.getToken()});
          });
          break;
        }
        case "logout": {
          TokenManager.setToken('');
          break;
        }
      }
    });
  }

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "compiled/sidebarScanner.js")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "compiled/sidebarScanner.css")
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
        -->
        <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}' https://www.paypal.com; child-src 'self' https://www.sandbox.paypal.com/;">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <script nonce="${nonce}">
          const apiBaseUrl = ${JSON.stringify(apiBaseUrl)};
          const tsvscode = acquireVsCodeApi();
          const nonce="${nonce}"
          console.log("${nonce}")
        </script>
			</head>
      <body>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}
