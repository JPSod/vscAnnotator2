import * as vscode from 'vscode';
import { apiBaseUrl } from './constants';
import * as polka from 'polka';
import { TokenManager } from './tokenManager';

export const authenticate = (fn: () => void) => {
    const app = polka();

    app.get('/auth/:token', async (req, res) => {
        const token = req.params.token;
        if (!token) {
            res.end('Something went wrong!');
            return;
        }
        
        await TokenManager.setToken(token);
        fn();

        res.end('Github auth successful.  You can close this tab now!');

        app.server?.close();
    });

    app.listen(54321, (err: Error) => {
        if (err) {
            vscode.window.showErrorMessage(err.message);
        } else {
            vscode.commands.executeCommand('vscode.open', 
                vscode.Uri.parse(`${apiBaseUrl}/auth/github`));
        }
     }); 
};