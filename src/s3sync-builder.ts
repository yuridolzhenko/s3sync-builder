import {BuilderContext, BuilderOutput, createBuilder} from '@angular-devkit/architect';
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
import {SyncOptions} from "./sync-options.model";

interface Options extends JsonObject {

    syncDir: string;
    targetBucket: string;

}

export default createBuilder(s3syncBuilder);

function s3syncBuilder(options: JsonObject,
                       context: BuilderContext): Promise<BuilderOutput> {
    return new Promise<BuilderOutput>((resolve, reject) => {
        // AWS.config.update(configOptions);

        const S3 = new AWS.S3({apiVersion: '2006-03-01'});
        const syncOptions = <SyncOptions>options;

        let listRequest: ListObjectsV2Request = {
            Bucket: syncOptions.targetBucket
        };

        let scanBucketContents = function scanBucketContents(request: ListObjectsV2Request): Promise<Object[]> {
            let scanningMsg = `Scanning "${syncOptions.targetBucketName}" bucket for existing files...`;
            context.logger.info(scanningMsg);
            context.reportStatus(scanningMsg);
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
        const buildPath: string = path.normalize(syncOptions.buildPath);
        let totalArtifactsLength = 0;
        let totalExistingFiles = 0;
        let deletedMarker = 0;
        let syncedMarker = 0;

        if (!fs.existsSync(`./${buildPath}`)) {
            let pathDoesntExistMsg = 'Specified path does not exist.';
            context.logger.error(pathDoesntExistMsg);
            context.reportStatus(pathDoesntExistMsg);
            resolve({success: false});
        }
        const syncObservable: Observable<any> = from(scanBucketContents(listRequest))
            .pipe(
                tap((existingFiles: Object[]) => {


                    let deleteWarningMsg = `Found ${existingFiles.length} existing files in the bucket. About to delete them...`;
                    context.logger.info(deleteWarningMsg);
                    context.reportStatus(deleteWarningMsg);
                    totalExistingFiles = totalExistingFiles + existingFiles.length;
                }),
                mergeAll(),
                mergeMap((bucketEntry) => {
                    let bucketEntryKey: string = bucketEntry.Key as string;
                    let deleteObjectRequest: DeleteObjectRequest = {
                        Bucket: syncOptions.targetBucket,
                        Key: bucketEntryKey
                    };
                    return from(S3.deleteObject(deleteObjectRequest).promise());
                }),
                tap(entry => {
                    deletedMarker = deletedMarker + 1;
                    context.logger.info(`Deleted ${deletedMarker} out of ${totalExistingFiles} files...`);
                    context.reportProgress(deletedMarker, totalExistingFiles, 'Cleaning up the bucket...');
                }),
                count(),
                tap((totalCount: number) => {
                    let buildPathScanningMsg = `Done with deleting ${totalCount} files. Scanning the build path...`;
                    context.logger.info(buildPathScanningMsg);
                    context.reportStatus(buildPathScanningMsg);
                }),
                mergeMap(whoCares => {
                    return of(glob.sync(`/**`, {
                        root: buildPath,
                        nodir: true,
                        matchBase: true
                    }));
                }),
                tap((buildPathContents: string[]) => {
                    totalArtifactsLength = buildPathContents.length;
                    let syncWarningMsg = `Found ${buildPathContents.length} files on the build path. About to sync them to the bucket...`;
                    context.logger.info(syncWarningMsg);
                    context.reportStatus(syncWarningMsg);
                }),
                mergeAll(),
                tap((buildPathEntry: string) => {
                    let uploadingMsg = `Uploading "${buildPathEntry}"...`;
                    context.logger.info(uploadingMsg);
                    context.reportStatus(uploadingMsg);
                }),
                mergeMap((newBucketEntry: string) => {
                    const basename: string = path.basename(newBucketEntry);
                    const dirname: string = path.dirname(newBucketEntry);
                    const relative: string = path.relative(buildPath, dirname);
                    const pathOnBucket: string = relative == '' ? basename : relative + '/' + basename;
                    const buffer = fs.readFileSync(newBucketEntry);
                    context.logger.info(`Found "${newBucketEntry}"...`);
                    const putObjectRequest: PutObjectRequest = {
                        Bucket: syncOptions.targetBucket,
                        Key: pathOnBucket,
                        Body: buffer
                    };
                    return from(S3.putObject(putObjectRequest).promise());
                }),
                tap(entry => {
                    syncedMarker = syncedMarker + 1;
                    context.logger.info(`Uploaded ${syncedMarker} out of ${totalExistingFiles} entries...`);
                    context.reportProgress(syncedMarker, totalExistingFiles, `Syncing to the "${syncOptions.targetBucket}"...`);
                }),
                count(),
                tap((entriesUploaded: number) => {
                    context.reportStatus(`Done with uploading ${entriesUploaded} files.`);
                })
            );

        syncObservable.subscribe(whoCares => {
        }, error => {
            context.logger.error('Failed to finish sync routine.', error);
            context.reportStatus('Failed. Check logs for details.');
            resolve({success: false});
        }, () => {
            context.logger.info('Done. Have fun.');
            context.reportStatus('Done. Have fun.');
            resolve({success: true});
        });
    });

}

