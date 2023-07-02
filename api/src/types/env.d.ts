declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_CLIENT_SECRET: string;
      GITHUB_CLIENT_ID: string;
    }
  }
}

export {}
