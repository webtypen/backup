const fs = require("fs");
const path = require("path");
const moment = require("moment");
const mainPath = require("path").dirname(require.main.filename);
const Client = require("ssh2-sftp-client");
const { execSync } = require("child_process");

exports.backup = async (definitionPath) => {
    if (!definitionPath || !fs.existsSync(definitionPath)) {
        console.log("Backup-Definition `" + definitionPath + "` not found ...");
        return;
    }

    const definitionFolder = definitionPath.substring(0, definitionPath.lastIndexOf("/backup.json"));
    if (!definitionFolder || !fs.existsSync(definitionFolder)) {
        console.log("Backup-Definition `" + definitionPath + "` not found ...");
        return;
    }

    const definitionString = fs.readFileSync(definitionPath, "utf-8");
    const definition = definitionString ? JSON.parse(definitionString) : null;
    if (!definition) {
        console.log("Empty backup definition ...");
        return;
    }

    const backupData = {
        date: moment().format("YYYY-MM-DD"),
        time: moment().format("HHmmss"),
        dir: mainPath + "/backups/" + moment().format("YYYY-MM-DD") + "_" + moment().format("HHmmss"),
    };
    if (!fs.existsSync(backupData.dir)) {
        fs.mkdirSync(backupData.dir, { recursive: true });
    }

    const absolutePath = path.resolve(definitionFolder);
    if (!absolutePath || absolutePath.trim() === "") {
        console.log("Backup-Definition `" + definitionPath + "` not found (absolute-path) ...");
        return;
    }

    if (definition.steps && definition.steps.length > 0) {
        for (let step of definition.steps) {
            for (let key in backupData) {
                step = step.split("{BACKUP_" + key.trim().toUpperCase() + "}").join(backupData[key]);
            }

            execSync("cd " + absolutePath + " && " + step, {
                stdio: "inherit",
            });
        }
    }

    if (definition && definition.upload && definition.upload.mode === "sftp") {
        const sftp = new Client();
        try {
            await sftp.connect({
                host: definition.upload.host,
                username: definition.upload.user,
                password: definition.upload.password ? definition.upload.password : undefined,
                port:
                    definition.upload.port && parseInt(definition.upload.port) > 0
                        ? parseInt(definition.upload.port)
                        : 22,
                privateKey: definition.upload.privateKey ? fs.readFileSync(definition.upload.privateKey) : undefined,
            });

            await sftp.uploadDir(
                backupData.dir,
                (definition.upload.basedir ? definition.upload.basedir : "") +
                    "/backup_" +
                    backupData.date +
                    "_" +
                    backupData.time,
                {
                    recursive: true,
                }
            );

            await sftp.end();
        } catch (e) {
            console.error(e);
        }
    }
};
