import {BuilderOutput, createBuilder} from '@angular-devkit/architect';
import {JsonObject} from '@angular-devkit/core';
import * as AWS from 'aws-sdk';
import {ConfigurationOptions} from "aws-sdk/lib/config";
import {DeleteObjectRequest, ListObjectsV2Output, ListObjectsV2Request, Object, ObjectKey} from "aws-sdk/clients/s3";

interface Options extends JsonObject {

    syncDir: string;
    targetBucket: string;

}

// async function allBucketKeys(s3: any, bucket: string) {
//     const params = {
//         Bucket: bucket,
//     };
//
//     var keys: any = [];
//     for (;;) {
//         var data = await s3.listObjects(params).promise();
//
//         data.Contents.forEach((elem: any) => {
//             keys = keys.concat(elem.Key);
//         });
//
//         if (!data.IsTruncated) {
//             break;
//         }
//         params.Marker = data.NextMarker;
//     }
//
//     return keys;
// }


export default createBuilder<Options>((options, context) => {
    return new Promise<BuilderOutput>((resolve, reject) => {
        // let configOptions = <ConfigurationOptions>options;
        // AWS.config.update(configOptions);

        const S3 = new AWS.S3({apiVersion: '2006-03-01'});

        let listRequest: ListObjectsV2Request = {
            Bucket: options.targetBucket
        };

        let deleteObjects = function deleteContents(bucketContents: Object[]) {
            return new Promise((resolve, reject) => {
                console.info(bucketContents);
                for (let entry in bucketContents) {
                    let key: string = bucketContents[entry].Key as string;

                    let deleteObjectRequest : DeleteObjectRequest = {
                      Bucket: options.targetBucket,
                      Key: key
                    };
                    S3.deleteObject(deleteObjectRequest).promise();
                    console.info(key);
                }
            })
        };

        let scanBucketContents = function scanBucketContents(request: ListObjectsV2Request): Promise<Object[]> {
            const intermediateRequest: ListObjectsV2Request = Object.assign({}, request);
            return new Promise(resolve => {
                S3.listObjectsV2(intermediateRequest).promise().then((response: ListObjectsV2Output) => {
                    if (response.IsTruncated) {
                        intermediateRequest.ContinuationToken = response.NextContinuationToken;
                        scanBucketContents(intermediateRequest).then(array => {
                            if (response.Contents !== undefined) {
                                resolve(response.Contents.concat(array));
                            } else {
                                reject("");
                            }
                        });
                    } else {
                        resolve(response.Contents);
                    }
                }, err => {
                    reject(err);
                });

            });
        };

        let scanLocalContents = function scanLocalContents(localContentsPath: string): Promise<Object[]> {
            return Promise.resolve([]);
        };

        let syncContents = function syncContents(): Promise<boolean> {
            return Promise.resolve(true);
        };

        let invalidateBucketCache = function invalidateBucketCache(): Promise<boolean> {
            return Promise.resolve(true);
        };

        const path: string = '/Users/ydolzhenko/Projects/deploy-tester-app/src';

        scanBucketContents(listRequest)
            .then((objects: Object[]) => {
                return deleteObjects(objects);
            }).then(() => {
                console.info('here');
            });


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
        // resolve({success: true});
    });
});


