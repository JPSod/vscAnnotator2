import { RequestHandler, Request } from "express"
import jwt from "jsonwebtoken"

export type RequestHandlerWithUserId = Request<{}, any, any, { userId: number }>

export const isAuth: RequestHandler<{}, any, any, {}>= (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error("not authenticated");
    }
    
    const token = authHeader.split(" ")[1];
    if (!token) {
        throw new Error("not authenticated");
    }

    try {
      const payload: any = jwt.verify(token, process.env.JWT_ACCESS);
      req.userId = payload.userId;
      next();
      return;

    } catch {
    }

    throw new Error("not authenticated");
}