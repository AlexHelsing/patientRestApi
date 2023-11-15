import express from "express";
import { Request, Response } from "express";
import { Patient, validateRegistration, validateUpdate } from "../../models/patientsModel";
import validateObjectId from '../../middlewares/validObjectId'
import asyncwrapper from "../../middlewares/asyncwrapper";
import bcrypt from 'bcrypt';

const router = express.Router() 

// Dentist HTTP Handlers
// GET Requests

router.get('/', asyncwrapper( async(req: Request, res: Response) => {
    let patients = await Patient.find().select('-password');

    return res.status(200).json(patients);
}));

router.get('/:id', [validateObjectId],asyncwrapper(async (req: Request, res: Response) => {

    let patient = await Patient.findById(req.params.id).select('-password');

    if(!patient) return res.status(404).json({"message":"Patient with given id was not found"});

    res.status(200).json(patient);
}));


// POST requests
router.post('/', asyncwrapper( async(req: Request, res: Response) => {

    let { error } = validateRegistration(req.body);
    if(error) return res.status(403).json({"message": "Invalid patient information" + error.details[0].message});

    let patient = await Patient.findOne({email: req.body.email});
    if(patient) return res.status(409).json({"message": "Dentist with given email already exists"});

    patient = new Patient(req.body);
    await patient.hashPassword()
    let token = await patient.signJWT();

    let result = await patient.save()

    return res.status(201).json({"token": token, patient}) 
}));

// PUT requests
router.put('/:id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    
    let { error } = validateUpdate(req.body);
    if(error) return res.status(403).json({"message": "Invalid patient update format" + error.details[0].message});

    if(req.body.password){
        let hashed = await bcrypt.hash(req.body.password, 10);
        req.body.password = hashed;
    }   

    let patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {new: true}).select('-password');
    if(!patient) return res.status(404).json({"message": "Patient with given id was not found."});

    res.status(200).json(patient);
}));

// DELETE Requests

router.delete('/:id', [validateObjectId], asyncwrapper(async (req: Request, res: Response) => {

    let patient = await Patient.findByIdAndDelete(req.params.id).select('-password');
    if(!patient) return res.status(404).json({"message": "Patient with given id was not found."});

    res.status(200).json(patient);
}));

// Exporting the router object
export default router;