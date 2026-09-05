import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dsgRouter from "./dsg";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dsgRouter);

export default router;
