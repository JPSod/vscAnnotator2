# vscAnnotator2

Welcome to the VS Scribe repo.\
Please contact jpesfreitas@gmail.com for the transformer model used in \BERT.\
It is also necessary to add a .env file to the api folder, which should contain the following variables:

GITHUB_CLIENT_SECRET= GitHub account secret for login.\
GITHUB_CLIENT_ID= Github host accountid to verify the application\
PAYPAL_CLIENT_ID= Paypal Client ID\
PAYPAL_CLIENT_SECRET= Payapl Secret linked to your account\
PAYPAL_ENVIRONMENT=sandbox\
SESSION_SECRET= Some random long value to act as a session secret\
JWT_ACCESS= Another long random variable\
GMAIL_USER = details to the linked gmail acount which will send the scans\
GMAIL_PASS = the password to that gmail account\
PYTHON_EXECUTABLE = path to the python.exe file in your machine\
CONDA_ENV = name of the virtual env to run the python child processes.

After adding then .env file and the transformer model, open the vscannotator2 folder in VS Code and run "npm run dev" in the "api" directory and "npm run watch" in the extension directory.\
Please see https://youtu.be/_imevSrJh-M
