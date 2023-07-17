// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { HelloWorldPanel } from "./HelloWorldPanel";
import { SidebarScannerProvider } from "./SidebarScannerProvider";
import { SidebarStandardsProvider } from "./SidebarStandardsProvider";
import { authenticate } from "./authenticate";
import { TokenManager } from "./tokenManager";
import { apiBaseUrl } from "./constants";
import fetch from 'node-fetch';


export function activate(context: vscode.ExtensionContext) {

  TokenManager.globalState = context.globalState;

  const sidebarScannerProvider = new SidebarScannerProvider(context.extensionUri);
  const sidebarStandardsProvider = new SidebarStandardsProvider(context.extensionUri);

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
    vscode.window.registerWebviewViewProvider("vscribe-sidebar-standards", sidebarStandardsProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscribe.scanFile', async (args) => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          vscode.window.showErrorMessage("No active text editor");
          return;
        }

        if (!(editor && editor.document.languageId === 'python')) {
            vscode.window.showErrorMessage('Active file is not a Python file!');
            return;
        } 

        if (!args[0]) {
          vscode.window.showErrorMessage('No standard selected!');
          return;
        }

        vscode.window.showInformationMessage(args[0]);
        const text = editor.document.getText();

        const strings: string[] = [];

        // Regular expression to match strings in Python
        const regex = /(['"])(?:(?=(\\?))\2.)*?\1/g;

        let match;
        while ((match = regex.exec(text))) {
            const string = match[0];
            strings.push(string);
        }

        const numStrings = strings.length;

        vscode.window.showInformationMessage(`Number of strings: ${numStrings}`);
        vscode.window.showInformationMessage(`Strings: ${strings.join(', ')}`);

        //const response = await fetch(`${apiBaseUrl}/scan`, {
        //  method: 'POST',
        //  headers: { 
        //    // eslint-disable-next-line @typescript-eslint/naming-convention
        //    'Content-Type': 'application/json',
        //    // eslint-disable-next-line @typescript-eslint/naming-convention
        //    Authorization: `Bearer ${args[1]}`,
        //   },
        //  body: JSON.stringify({
        //    standard: args[0],
        //    value: text,
        //    file: editor.document.fileName,
        //  }),
        //});
//
        //const {scan} = await response.json();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscribe.helloWorld", () => {
      HelloWorldPanel.createOrShow(context.extensionUri);
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
      // HelloWorldPanel.kill();
      // HelloWorldPanel.createOrShow(context.extensionUri);
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

  context.subscriptions.push(
    vscode.commands.registerCommand("vscribe.askQuestion", async () => {
      const answer = await vscode.window.showInformationMessage(
        "How was your day?",
        "good",
        "bad"
      );

      if (answer === "bad") {
        vscode.window.showInformationMessage("Sorry to hear that");
      } else {
        console.log({ answer });
      }
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

