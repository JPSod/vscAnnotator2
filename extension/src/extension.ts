// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { EditStandardsPanel } from "./EditStandardsPanel";
import { SidebarScannerProvider } from "./SidebarScannerProvider";
import { authenticate } from "./authenticate";
import { TokenManager } from "./tokenManager";
import { apiBaseUrl } from "./constants";
import axios from 'axios';
import { access } from "fs";


export function activate(context: vscode.ExtensionContext) {

  TokenManager.globalState = context.globalState;

  const sidebarScannerProvider = new SidebarScannerProvider(context.extensionUri);

  //const item = vscode.window.createStatusBarItem(
  //  vscode.StatusBarAlignment.Right
  //);
  //item.text = "$(beaker) Add Todo";
  //item.command = "vscribe.addTodo";
  //item.show();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("vscribe-sidebar-scanner", sidebarScannerProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscribe.scanFile', async (args) => {
        const editor = vscode.window.activeTextEditor;

        const standardId = args[0];
        const accessToken = args[1];
        

        if (!editor) {
          vscode.window.showErrorMessage("No active text editor");
          return;
        }

        if (!(editor && editor.document.languageId === 'python')) {
            vscode.window.showErrorMessage('Active file is not a Python file!');
            return;
        } 

        // eslint-disable-next-line eqeqeq
        if (!standardId ) {
          vscode.window.showErrorMessage('No standard selected!');
          return;
        }

        const text = editor.document.getText();

        //const strings: string[] = [];

        //// Regular expression to match strings in Python
        //const regex = /(['"])(?:(?=(\\?))\2.)*?\1/g;

        //let match;
        //while ((match = regex.exec(text))) {
        //    const string = match[0];
        //    strings.push(string);
        //}

        //const numStrings = strings.length;

        //vscode.window.showInformationMessage(`Number of strings: ${numStrings}`);
        //vscode.window.showInformationMessage(`Strings: ${strings.join(', ')}`);
        
        await axios.post(`${apiBaseUrl}/scans`, {
          standardId: standardId,
          value: text,
          file: editor.document.fileName,
        }, {
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Authorization': `Bearer ${accessToken}`,
          },
        });

    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscribe.editStandards", () => {
      EditStandardsPanel.createOrShow(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscribe.authenticate", () => {
      authenticate(() => {});
      //vscode.window.showInformationMessage('token value: ' + TokenManager.getToken());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscribe.refresh", async () => {
      await vscode.commands.executeCommand("workbench.action.closeSidebar");
      await vscode.commands.executeCommand(
        "workbench.view.extension.vscribe-sidebar-view"
      );
      // setTimeout(() => {
      //   vscode.commands.executeCommand(
      //     "workbench.action.webview.openDeveloperTools"
      //   );
      // }, 500);
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

