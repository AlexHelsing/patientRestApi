import mqtt from 'mqtt';

const BROKER_URL = process.env.BROKER_URL || "mqtt://localhost"; 
const USER = process.env.USER || 'user';
const PASSWORD = process.env.PASSWORD || 'password';

const options = {
    username: USER,
    password: PASSWORD
}

const client =  mqtt.connect(BROKER_URL, options);

client.on('connect', () => {
    console.log(`Mqtt connected to broker at ${BROKER_URL}`);
})

client.on('error', (err) => {
    console.error(err.message)
})

async function handleMqtt(client: mqtt.MqttClient, requestTopic: string, responseTopic: string, payload: object | Array<any>){

    let publishAsync = () => new Promise<void>((resolve) => {
        client.publish(requestTopic, JSON.stringify(payload), {qos: 1}, (err) => {
            if(err !== null) console.log(err)
            resolve();
        })
    });

    let subscribeAsync = () => new Promise<void>((resolve) => {
        client.subscribe(responseTopic, (err) => {
            if(err !== null) console.log(err);
            resolve()
        })
    });

    await Promise.all([subscribeAsync(), publishAsync()]);

    // TODO: Add a timeout for requests that take longer than 5 sec to resolve.
    const response = await new Promise<any>((resolve) => {
        client.on('message', (topic, payload, packet) => {
            if(responseTopic === topic) {
                client.unsubscribe(responseTopic);
                console.log(`topic: ${topic}, payload: ${payload}`);
                resolve(JSON.parse(payload.toString()));
            }
        });
    });
    return response;
}

export {client, handleMqtt};