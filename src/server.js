const express = require("express");
const path = require("path");
const stream = require("stream");
const k8s = require("@kubernetes/client-node");
const app = express();

// Set EJS as templating engine
app.set("view engine", "ejs");

// Set views directory
app.set("views", path.join(__dirname, "/views"));

app.get("/", (req, res) => {
    const data = {
        title: "Home",
        message: "Welcome to our homepage!",
    };
    res.render("index", data);
});

const startLogStreaming = async () => {
    const namespace = "prod";
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const log = new k8s.Log(kc);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    let logStreams = [];
    try {
        const { body } = await k8sApi.listNamespacedPod(namespace);
        const podNames = body.items
            .filter((item) => {
                return item.metadata.name.startsWith("api");
            })
            .map((item) => {
                return item.metadata.name;
            });

        podNames.forEach(async (podname) => {
            const logStream = new stream.PassThrough();

            logStream.on("data", (chunk) => {
                // use write rather than console.log to prevent double line feed
                const data = `${podname}: ${chunk}`;
                process.stdout.write(data);
            });

            logStreams.push({
                stream: logStream,
                podname: podname,
            });

            await log.log(namespace, podname, null, logStream, {
                follow: true,
                tailLines: 50,
                pretty: true,
                timestamps: true,
            });
        });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

app.listen(3002, () => {
    console.log("Server is running on localhost:3002");
    startLogStreaming();
});
