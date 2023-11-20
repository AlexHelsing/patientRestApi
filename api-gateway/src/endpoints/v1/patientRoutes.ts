import express from "express";
import { Request, Response } from "express";
import { Patient, validateRegistration, validateUpdate } from "../../models/patientsModel";
import validateObjectId from '../../middlewares/validObjectId'
import asyncwrapper from "../../middlewares/asyncwrapper";
import authPatient from "../../middlewares/authPatient";
import bcrypt from 'bcrypt';
import client from "../../mqttConnection";
import _ from 'lodash';

const router = express.Router() 

// Dentist HTTP Handlers
// GET Requests

router.get('/', asyncwrapper( async(req: Request, res: Response) => {
    let patients = await Patient.find().select('-password');

    return res.status(200).json(patients);
}));

router.get('/:id', [validateObjectId, authPatient],asyncwrapper(async (req: Request, res: Response) => {

    let patient = await Patient.findById(req.params.id).select('-password');

    if(!patient) return res.status(404).json({"message":"Patient with given id was not found"});

    res.status(200).json(patient);
}));

router.get('/:id/appointments', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let patient = await Patient.findById(req.params.id);
    if(!patient) return res.status(404).json({"message":"Patient with given id was not found."});

    if(!client.connected) return res.status(500).json({"message":"Internal server error"});

    const Reqtopic = "Patient/get_appointments/req";
    const Restopic = "Patient/get_appointments/res";

    let publishAsync = () => new Promise<void>((resolve) => {
        client.publish(Reqtopic, JSON.stringify({patient_id: patient?._id}), {qos: 1}, (err) => {
            if(err !== null) console.log(err)
            resolve();
        })
    });

    let subscribeAsync = () => new Promise<void>((resolve) => {
        client.subscribe(Restopic, (err) => {
            if(err !== null) console.log(err);
            resolve()
        })
    });

    await Promise.all([subscribeAsync(), publishAsync()]);

    // TODO: Add a timeout for requests that take longer than 5 sec to resolve.
    const response = await new Promise<any>((resolve) => {
        client.on('message', (topic, payload, packet) => {
            if(Restopic === topic) {
                client.unsubscribe(Restopic);
                console.log(`topic: ${topic}, payload: ${payload}`);
                resolve(JSON.parse(payload.toString()));
            }
        });
    });

    let status = response.pop().status;
    return res.status(status).json(response);    
}));

router.get('/:id/appointments/:appointment_id', asyncwrapper( async(req: Request, res: Response) => {
    let patient = await Patient.findById(req.params.id);
    if(!patient) return res.status(404).json({"message":"Patient with given id was not found."});

    if(!client.connected) return res.status(500).json({"message":"Internal server error"});

    const Reqtopic = "Patient/get_appointments/req";
    const Restopic = "Patient/get_appointments/res";

    let publishAsync = () => new Promise<void>((resolve) => {
        client.publish(Reqtopic, JSON.stringify({patient_id: patient?._id}), {qos: 1}, (err) => {
            if(err !== null) console.log(err)
            resolve();
        })
    });

    let subscribeAsync = () => new Promise<void>((resolve) => {
        client.subscribe(Restopic, (err) => {
            if(err !== null) console.log(err);
            resolve()
        })
    });

    await Promise.all([subscribeAsync(), publishAsync()]);

    // TODO: Add a timeout for requests that take longer than 5 sec to resolve.
    const response = await new Promise<any>((resolve) => {
        client.on('message', (topic, payload, packet) => {
            if(Restopic === topic) {
                client.unsubscribe(Restopic);
                console.log(`topic: ${topic}, payload: ${payload}`);
                resolve(JSON.parse(payload.toString()));
            }
        });
    });
    
    let status = response.pop().status;

    let appointment = response.find((appointment:any) => {
        if(appointment._id === req.params.appointment_id){
            return appointment;
        }
    })

    if(!appointment) return res.status(404).json({"message": "Appointment with given id was not found"});
    
    return res.status(status).json(appointment);
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

router.post('/login', asyncwrapper( async(req: Request, res: Response) => {

    if(!req.body.email || !req.body.password) return res.status(403).json({"message":"No email or password was provided"});

    let patient = await Patient.findOne({email: req.body.email});
    if(!patient) return res.status(404).json({"message":"Patient with given email does not exist"});

    let match = await bcrypt.compare(req.body.password, patient.password.toString());
    if(!match) return res.status(403).json({"message":"Wrong password"});

    let token = await patient.signJWT();

    res.status(201).json({patient, "token": token});
}));

router.post('/:id/appointments', [validateObjectId, authPatient], asyncwrapper(async(req: Request, res: Response) => {
    let patient = await Patient.findById(req.params.id);
    if(!patient) return res.status(404).json({"message":"Patient with given id was not found."});

    if(!client.connected) return res.status(500).json({"message":"Internal server error"});

    const Reqtopic = "Patient/make_appointment/req";
    const Restopic = "Patient/make_appointment/res";

    let subscribeAsync = () => new Promise<void>((resolve) => {
        client.subscribe(Restopic, (err) => {
            if(err !== null) console.log(err);
            resolve();
        });
    })

    let publishAsync = () => new Promise<void>((resolve) => {
        client.publish(Reqtopic, JSON.stringify({patient_id: patient?._id, appointment_id: req.body.appointment_id}), {qos: 1}, (err) => {
            if(err !== null) console.log(err);
            resolve();
        });
    });

    await Promise.all([subscribeAsync(), publishAsync()]);

    const response = await new Promise<any>((resolve) => {
        client.on('message', (topic, payload, packet) => {
            if(topic === Restopic) {
                client.unsubscribe(Restopic);
                console.log(`topic: ${topic}, payload: ${payload}`);
                resolve(JSON.parse(payload.toString()));
            } 
        });
    });

    res.status(response.status).json(response);
}));

// PUT requests
router.put('/:id', [validateObjectId, authPatient], asyncwrapper( async(req: Request, res: Response) => {
    
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

router.delete('/:id/appointments/:appointment_id', [validateObjectId, authPatient], asyncwrapper( async(req: Request, res:Response) => {
    let patient = await Patient.findById(req.params.id);
    if(!patient) return res.status(404).json({"message":"Patient with given id was not found."});

    if(!client.connected) return res.status(500).json({"message":"Internal server error"});

    const Reqtopic = "Patient/cancel_appointment/req";
    const Restopic = "Patient/cancel_appointment/res";

    let subscribeAsync = () => new Promise<void>((resolve) => {
        client.subscribe(Restopic, (err) => {
            if(err !== null) console.log(err);
            resolve();
        });
    })

    let publishAsync = () => new Promise<void>((resolve) => {
        client.publish(Reqtopic, JSON.stringify({patient_id: patient?._id, appointment_id: req.params.appointment_id}), {qos: 1}, (err) => {
            if(err !== null) console.log(err);
            resolve();
        });
    });

    await Promise.all([subscribeAsync(), publishAsync()]);

    const response = await new Promise<any>((resolve) => {
        client.on('message', (topic, payload, packet) => {
            if(topic === Restopic) {
                client.unsubscribe(Restopic);
                console.log(`topic: ${topic}, payload: ${payload}`);
                resolve(JSON.parse(payload.toString()));
            } 
        });
    });

    res.status(response.status).json(_.pick(response, ['message', 'isCancelled']));
}));

// Exporting the router object
export default router;