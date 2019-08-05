import {JsonObject} from '@angular-devkit/core';

export interface SyncOptions extends JsonObject {

    targetBucket: string;
    buildPath: string;

}