// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { HelloWorldPanel } from "./HelloWorldPanel";
import { SidebarScannerProvider } from "./SidebarScannerProvider";
import { SidebarStandardsProvider } from "./SidebarStandardsProvider";

export function activate(context: vscode.ExtensionContext) {
  const sidebarScannerProvider = new SidebarScannerProvider(context.extensionUri);
  const sidebarStandardsProvider = new SidebarStandardsProvider(context.extensionUri);

  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  );
  item.text = "$(beaker) Add Todo";
  item.command = "vscribe.addTodo";
  item.show();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("vscribe-sidebar-scanner", sidebarScannerProvider)
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("vscribe-sidebar-standards", sidebarStandardsProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscribe.addTodo", () => {
      const { activeTextEditor } = vscode.window;

      if (!activeTextEditor) {
        vscode.window.showInformationMessage("No active text editor");
        return;
      }

      const text = activeTextEditor.document.getText(
        activeTextEditor.selection
      );

      sidebarScannerProvider._view?.webview.postMessage({
        type: "new-todo",
        value: text,
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscribe.scanFile', (standards) => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          vscode.window.showErrorMessage("No active text editor");
          return;
        }

        if (!(editor && editor.document.languageId === 'python')) {
            vscode.window.showErrorMessage('Active file is not a Python file!');
            return;
        } 

        if (!standards) {
          vscode.window.showErrorMessage('No standard selected!');
          return;
        }

        vscode.window.showInformationMessage(standards);
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
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscribe.helloWorld", () => {
      HelloWorldPanel.createOrShow(context.extensionUri);
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
