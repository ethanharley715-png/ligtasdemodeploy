declare global {
  namespace Express {
    interface Request {
      user?: {
        id?: string | number;
        userId?: number;
        email?: string;
        role?: string;
      };
    }
  }
}

export {};
