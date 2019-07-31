import {BuilderOutput, createBuilder} from '@angular-devkit/architect';
import {JsonObject} from '@angular-devkit/core';
import * as AWS from 'aws-sdk';
import {
    DeleteObjectRequest,
    ListObjectsV2Output,
    ListObjectsV2Request,
    Object,
    PutObjectRequest
} from "aws-sdk/clients/s3";
import {from, Observable, of} from "rxjs";
import {count, mergeAll, mergeMap, tap} from "rxjs/operators";
import * as glob from "glob";
import * as path from "path";
import * as fs from "fs";

interface Options extends JsonObject {

    syncDir: string;
    targetBucket: string;

}

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

        const buildPath: string = path.normalize('/Users/ydolzhenko/Projects/deploy-tester-app/src');

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
                mergeMap((newBucketEntry) => {
                    const basename: string = path.basename(newBucketEntry);
                    const dirname: string = path.dirname(newBucketEntry);
                    const relative: string = path.relative(buildPath, dirname);
                    const pathOnBucket: string = relative + '/' + basename;
                    const buffer = fs.readFileSync(newBucketEntry);
                    const putObjectRequest: PutObjectRequest = {
                        Bucket: options.targetBucket,
                        Key: pathOnBucket,
                        Body: buffer
                    };
                    return from(S3.putObject(putObjectRequest).promise());
                }),
                count(),
                tap((entriesUploaded) => {
                    console.info('entries uploaded - ' + entriesUploaded);
                })
                // mergeMap(new)

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
    });
});


