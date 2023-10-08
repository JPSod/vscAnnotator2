import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import { apiBaseUrl } from "./constants";
import { TokenManager } from "./tokenManager";
import { authenticate } from "./authenticate";
import { FailedFunction} from "./types/types";

async function callScanFileCommand(standardId: number, accessToken: string) {
  try {
    const result = await vscode.commands.executeCommand('vscribe.scanFile', [standardId, accessToken]);
    return result;
  } catch (error) {
    console.error('Failed to execute the scanFile command:', error);
    throw error; // Rethrow the error to propagate it
  }
}

async function callEditStandardsCommand(accessToken: string) {
  try {
      await vscode.commands.executeCommand('vscribe.editStandards', accessToken);
  } catch (error) {
      console.error('Failed to execute the scanFile command:', error);
  }
}

async function callseeScanDetailsCommand(scan: any) {
  try {
      createScanWebView(scan);
  } catch (error) {
      console.error('Failed to execute the scanFile command:', error);
  }
}


function createScanWebView(scan: any) {
  const panel = vscode.window.createWebviewPanel(
    scan.id.toString(),
    'Scan Details',
    vscode.ViewColumn.One, 
    {
      enableScripts: true, // Enable JavaScript in the WebView
    }
  );
  const failedFunctions: FailedFunction[] = scan.failedFunctions as FailedFunction[];

      const formattedFailedFunctions = failedFunctions.map((failedFunction) => {
        return `
          <li>
            <p><strong>Rule:</strong> ${failedFunction['Rule']}</p>
            <p><strong>Function/Class:</strong></p>
            <pre><code>${failedFunction['Function/Class']}</code></pre>
          </li>
        `;
      });

      // Update the email content
      const content = `
        <h1>Scan Information</h1>
        <p><strong>Scan ID:</strong> ${scan.id}</p>
        <p><strong>Standard:</strong> ${scan.standardName}</p>
        <p><strong>Compliance Percentage:</strong> ${scan.value}</p>
        <p><strong>File:</strong> ${scan.file}</p>
        <h2>Failed Functions:</h2>
        <ul>
          ${formattedFailedFunctions.join('')}
        </ul>
        <p><strong>Created Date:</strong> ${scan.createdDate}</p>
      `;
  // Set the HTML content of the WebView
  panel.webview.html = content;

  // Handle when the panel is disposed (e.g., when the user closes it)
  panel.onDidDispose(() => {
    // Dispose of any resources or perform cleanup here
  });
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
          try {
            const result = await callScanFileCommand(data.standardId, data.accessToken);
            
            if (result === 'Scan complete') {
              // Send a message back to the webview to trigger fetchResults
              webviewView.webview.postMessage({ type: 'scanComplete' });
            } else {
              // Handle other cases as needed
            }
          } catch (error) {
            // Handle the error, e.g., show an error message
            vscode.window.showErrorMessage('Failed to initiate scan: ' + error);
          }
          break;
        }
        case "onConfirmArchiveScan": {
          vscode.window.showInformationMessage('Archive scan ' + data.scanId + '?', 'Yes', 'No').then(async (selection) => {
            if (selection === 'Yes') {
              try {
                webviewView.webview.postMessage({ type: 'archiveScanConfirmation', scanId: data.scanId });
              } catch (error) {
                vscode.window.showErrorMessage('Failed to archive scan: ' + error);
              }
            }
          });
          break;
        }
        case "editStandards": {
          await callEditStandardsCommand(data.accessToken);
          break;
        }
        case "seeScanDetails": {
          await callseeScanDetailsCommand(data.scan);
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
