# s3sync-builder

Angular CLI builder that syncs specified folder to a specified S3 bucket.

## Usage

Install with npm

```
npm install @ydolzhenko/s3sync-builder --save-dev
```

Add target configuration to your `angular.json` according to Angular CLI builder's [documentation](https://angular.io/guide/cli-builder):


```json
...
  "projects": {
    "sample-app": {
      "projectType": "application",
      "schematics": {},
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "deploy": {
          "builder": "@ydolzhenko/s3sync-builder:sync",
          "options": {
            "targetBucket": "sampleappbucket",
            "buildPath": "dist/sample-app"
          }
        },
        "build": {
...        
```
That's it. Now you should be able to run
```
ng run sample-app:deploy
```
and your angular application should be uploaded to the specified bucket.


You can also override settings per environment:

```json
...
      "architect": {
        "deploy": {
          "builder": "@ydolzhenko/s3sync-builder:sync",
          "options": {
            "targetBucket": "defaultBucket",
            "buildPath": "dist/sync-test"
          },
          "configurations": {
            "production": {
              "targetBucket": "prodBucket"
            },
            "test": {
              "targetBucket": "testBucket"
            }
          }
        },
```

And the command will look like
```
ng run sample-app:deploy --configuration=test
```


## Things to keep in mind

* Obviously under the hood builder uses AWS JS SDK, so access credentials must be configured the usual way.
* Before copying files, builder cleans the specified bucket up, so be careful and, optionally, have S3 versioning feature enabled.
* There is no atomic sync operation in AWS JS SDK available, so builder copies each file separately. In case of failure operation must be repeated, 
otherwise bucket will be corrupted.
* If you plan to use this builder, most probably you host your static application in S3 and there is a good chance that you
also have AWS Cloudfront CDN configured. If that is so CDN' cache must be invalidated in order for new bucket contents to
be picked up by CDN. Now you can do this manually, and automatic cache invalidation will be implemented in the next version of the builder.


