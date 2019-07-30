import {BuilderOutput, createBuilder} from '@angular-devkit/architect';
import {JsonObject} from '@angular-devkit/core';
import * as AWS from 'aws-sdk';
import {DeleteObjectRequest, ListObjectsV2Output, ListObjectsV2Request, Object} from "aws-sdk/clients/s3";
import {from, Observable, of} from "rxjs";
import {count, mergeAll, mergeMap, tap} from "rxjs/operators";
import * as glob from "glob";

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
                                resolve(array);
                            }
                        }, err => {
                            reject(err);
                        });
                    } else {
                        resolve(response.Contents);
                    }
                }, err => {
                    reject(err);
                });

            });
        };

        // let scanFolder = function getAllFiles(dirPath: string): void {
        //     fs.readdirSync(dirPath).forEach(function(file) {
        //         let filepath = path.join(dirPath , file);
        //         let stat= fs.statSync(filepath);
        //         if (stat.isDirectory()) {
        //             getAllFiles(filepath);
        //         } else {
        //             console.info(filepath+ '\n');
        //         }
        //     });
        // };

        let scanLocalContents = function scanLocalContents(localContentsPath: string): Promise<Object[]> {
            return Promise.resolve([]);
        };

        let syncContents = function syncContents(): Promise<boolean> {
            return Promise.resolve(true);
        };

        let invalidateBucketCache = function invalidateBucketCache(): Promise<boolean> {
            return Promise.resolve(true);
        };

        const buildPath: string = '/Users/ydolzhenko/Projects/deploy-tester-app/src';


        const syncObservable: Observable<any> = from(scanBucketContents(listRequest))
            .pipe(
                mergeAll(),
                tap((bucketEntry) => {
                    console.info('processing ' + bucketEntry.Key);
                }),
                mergeMap((bucketEntry) => {
                    let bucketEntryKey: string = bucketEntry.Key as string;
                    let deleteObjectRequest: DeleteObjectRequest = {
                        Bucket: options.targetBucket,
                        Key: bucketEntryKey
                    };
                    return from(S3.deleteObject(deleteObjectRequest).promise());
                }),
                count(),
                tap((totalCount: number) => {
                    console.info('deleted ' + totalCount);
                }),
                mergeMap(whoCares => {
                    return of(glob.sync(`/**`, {
                        root: buildPath,
                        nodir: true,
                        matchBase: true
                    }));
                }),
                mergeAll(),
                tap((newBucketEntry) => {
                    console.info(newBucketEntry);
                })
            );


        syncObservable.subscribe(whoCares => {
        }, error => {
            console.info('got error');
            console.info(error);
            resolve({success: false});
        }, () => {
            console.info('completed');
            resolve({success: true});
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


