import { Express } from "express";
import currentPatient from './currentPatient'
import patientRoutes from "./patientRoutes"

// All api routes will be added here 
export function routerV1(app: Express) {
    app.use('/api/v1/patients/current-user', currentPatient);
    app.use('/api/v1/patients', patientRoutes);
}