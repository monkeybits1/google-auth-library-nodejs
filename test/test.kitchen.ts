/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from 'assert';
import cp from 'child_process';
import fs from 'fs';
import mv from 'mv';
import {ncp} from 'ncp';
import path from 'path';
import pify from 'pify';
import tmp from 'tmp';

const mvp = pify(mv);
const ncpp = pify(ncp);
const keep = !!process.env.GALN_KEEP_TEMPDIRS;
const stagingDir = tmp.dirSync({keep, unsafeCleanup: true});
const stagingPath = stagingDir.name;
const pkg = require('../../package.json');

const spawnp =
    (command: string, args: string[], options: cp.SpawnOptions = {}) => {
      return new Promise((resolve, reject) => {
        cp.spawn(command, args, Object.assign(options, {stdio: 'inherit'}))
            .on('close',
                (code, signal) => {
                  if (code === 0) {
                    resolve();
                  } else {
                    reject(
                        new Error(`Spawn failed with an exit code of ${code}`));
                  }
                })
            .on('error', err => {
              reject(err);
            });
      });
    };

/**
 * Create a staging directory with temp fixtures used
 * to test on a fresh application.
 */
before('npm pack and move to staging directory', async () => {
  console.log(`${__filename} staging area: ${stagingPath}`);
  await spawnp('npm', ['pack']);
  const tarball = `${pkg.name}-${pkg.version}.tgz`;
  // stagingPath can be on another filesystem so fs.rename() will fail
  // with EXDEV, hence we use `mv` module here.
  await mvp(tarball, `${stagingPath}/google-auth-library.tgz`);
  await ncpp('test/fixtures/kitchen', `${stagingPath}/`);
});

it('should be able to use the d.ts', async () => {
    await spawnp('npm', ['install'], {cwd: `${stagingPath}/`});
  }).timeout(80000); // TODO: set pack to 40000 after removing node4

it('should be able to webpack the library', async () => {
    // we expect npm install is executed on the previous step
    await spawnp('npx', ['webpack'], {cwd: `${stagingPath}/`});
    const bundle = path.join(stagingPath, 'dist', 'bundle.min.js');
    const stat = fs.statSync(bundle);
    assert(stat.size < 256 * 1024);
  }).timeout(40000); // TODO: set to 20000 after removing node4

/**
 * CLEAN UP - remove the staging directory when done.
 */
after('cleanup staging directory', async () => {
  if (!keep) {
    stagingDir.removeCallback();
  }
});
