/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-logs-delete', 'logs');

export default class Org extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    name: flags.string({
      char: 'n',
      description: messages.getMessage('nameFlagDescription'),
    }),
    force: flags.boolean({
      char: 'f',
      description: messages.getMessage('forceFlagDescription'),
    }),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const conn = this.org.getConnection();
    const query = 'Select Id from ApexLog';

    // The type we are querying for
    interface ApexLog {
      Id: string;
    }

    // Query the org
    const result = await conn.queryAll<ApexLog>(query);

    // Organization will always return one result, but this is an example of throwing an error
    // The output and --json will automatically be handled for you.
    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoLogs'));
    }

    // Organization always only returns one result
    const logIds: string[] = result.records.map((record) => record.Id);
    const logIdArray: string[][] = [];
    for (let i = 0; i < logIds.length; i++) {
      if (i % 200 === 0) {
        logIdArray.push([]);
      }
      logIdArray[Math.floor(i / 200)].push(logIds[i]);
    }
    let recordCount = 0;
    this.ux.startSpinner('Deleting Logs');
    for (const run of logIdArray) {
      const delResult = await conn.delete<ApexLog>('ApexLog', run);
      if (Array.isArray(delResult)) {
        recordCount += delResult.filter((record) => record.success).length;
      }
    }
    this.ux.stopSpinner();

    const outputString = `Deleted ${recordCount} apex logs.`;
    this.ux.log(outputString);

    if (this.flags.force && this.args.file) {
      this.ux.log(`You input --force and a file: ${this.args.file as string}`);
    }

    // Return an object to be displayed with --json
    return { orgId: this.org.getOrgId(), outputString };
  }
}
