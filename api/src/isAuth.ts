import { RequestHandler, Request } from "express"
import jwt from "jsonwebtoken"

export type RequestHandlerWithUserId = Request<{}, any, any, { userId: number }>

export const isAuth: RequestHandler<{}, any, any, {}>= (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const payload: any = jwt.verify(token, process.env.JWT_ACCESS);
      req.userId = payload.userId;
      next();
      return;

    } catch {
    }

    return res.status(401).json({ message: "Not authenticated" });;
}