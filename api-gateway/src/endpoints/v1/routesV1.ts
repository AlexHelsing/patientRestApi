import { Express } from "express";
import patientRoutes from "./patientRoutes"

// All api routes will be added here 
export function routerV1(app: Express) {
    app.use('/api/v1/patients', patientRoutes);
}