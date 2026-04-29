import { Request, Response } from "express";
import { getVisibleUsersForRequester, getReportsForUser } from "../services/userReportService";

export const fetchUsersForAdminView = async (req: Request, res: Response) => {
  try {
    const users = await getVisibleUsersForRequester(req.user as any);
    res.json(users);
  } catch (error: any) {
    res.status(403).json({ message: error.message });
  }
};

export const fetchReportsForUser = async (req: Request, res: Response) => {
  try {
    const reports = await getReportsForUser(req.user as any, Number(req.params.id));
    res.json(reports);
  } catch (error: any) {
    res.status(403).json({ message: error.message });
  }
};