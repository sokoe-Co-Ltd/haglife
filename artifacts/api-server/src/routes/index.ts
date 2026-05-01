import { Router, type IRouter } from "express";
import healthRouter from "./health";
import residentsRouter from "./residents";
import staffRouter from "./staff";
import handoverNotesRouter from "./handoverNotes";
import vitalsRouter from "./vitals";
import mealsRouter from "./meals";
import weightsRouter from "./weights";
import eliminationsRouter from "./eliminations";
import dayServicesRouter from "./dayServices";
import bathReportsRouter from "./bathReports";
import insurancesRouter from "./insurances";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import photosRouter from "./photos";
import residentPhotosRouter from "./residentPhotos";
import eliminationPhotosRouter from "./eliminationPhotos";

const router: IRouter = Router();

router.use(photosRouter);
router.use(residentPhotosRouter);
router.use(eliminationPhotosRouter);
router.use(healthRouter);
router.use(dashboardRouter);
router.use(residentsRouter);
router.use(staffRouter);
router.use(handoverNotesRouter);
router.use(vitalsRouter);
router.use(mealsRouter);
router.use(weightsRouter);
router.use(eliminationsRouter);
router.use(dayServicesRouter);
router.use(bathReportsRouter);
router.use(insurancesRouter);
router.use(settingsRouter);

export default router;
