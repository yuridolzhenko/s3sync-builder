import { BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';

interface Options extends JsonObject {
    command: string;
    awsConfig: string[];
}

export default createBuilder<Options>((options, context) => {
    return new Promise<BuilderOutput>((resolve, reject) => {

        // var AWS = require('aws-sdk');
        //
        // AWS.config.update(<ConfigurationOptions> options.awsConfig);
        //
        // var s3 = new AWS.S3({apiVersion: '2006-03-01'});
        // let flag: boolean = false;
        //
        context.reportStatus(`Executing "${options.command}"...`);
        // if (!flag) {
        //     reject();
        // }
        // const child = childProcess.spawn(options.command, options.args, { stdio: 'pipe' });

        // child.stdout.on('data', (data) => {
        //     context.logger.info(data.toString());
        // });
        // child.stderr.on('data', (data) => {
        //     context.logger.error(data.toString());
        //     reject();
        // });

        // context.reportStatus(`Done.`);
        // child.on('close', code => {
        //     resolve({ success: code === 0 });
        // });
        resolve({ success: true});
    });
});


