/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as utils from '../../common/utils';
import { ApiWrapper } from '../../common/apiWrapper';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { Config } from '../../configurations/config';
import { DeployedModelService } from '../../modelManagement/deployedModelService';
import { QueryRunner } from '../../common/queryRunner';
import { RegisteredModel } from '../../modelManagement/interfaces';
import { ModelPythonClient } from '../../modelManagement/modelPythonClient';
import * as path from 'path';
import * as os from 'os';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as fs from 'fs';
import { ModelConfigRecent } from '../../modelManagement/modelConfigRecent';
import { DatabaseTable } from '../../prediction/interfaces';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	config: TypeMoq.IMock<Config>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
	modelClient: TypeMoq.IMock<ModelPythonClient>;
	recentModels: TypeMoq.IMock<ModelConfigRecent>;
	importTable: DatabaseTable;
}

function createContext(): TestContext {

	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		config: TypeMoq.Mock.ofType(Config),
		queryRunner: TypeMoq.Mock.ofType(QueryRunner),
		modelClient: TypeMoq.Mock.ofType(ModelPythonClient),
		recentModels: TypeMoq.Mock.ofType(ModelConfigRecent),
		importTable: {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		}
	};
}

describe('DeployedModelService', () => {
	it('getDeployedModels should fail with no connection', async function (): Promise<void> {
		const testContext = createContext();
		let connection: azdata.connection.ConnectionProfile;
		let importTable: DatabaseTable = {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		};

		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		await should(service.getDeployedModels(importTable)).rejected();
	});

	it('getDeployedModels should returns models successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const expected: RegisteredModel[] = [
			{
				id: 1,
				artifactName: 'name1',
				title: 'title1',
				description: 'desc1',
				created: '2018-01-01',
				version: '1.1',
				table: testContext.importTable

			}
		];
		const result = {
			rowCount: 1,
			columnInfo: [],
			rows: [
				[
					{
						displayValue: '1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: 'name1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: 'title1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: 'desc1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: '1.1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: '2018-01-01',
						isNull: false,
						invariantCultureDisplayValue: ''
					}
				]
			]
		};
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));

		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'db');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'table');
		const actual = await service.getDeployedModels(testContext.importTable);
		should.deepEqual(actual, expected);
	});

	it('loadModelParameters should load parameters using python client successfully', async function (): Promise<void> {
		const testContext = createContext();
		const expected = {
			inputs: [
				{
					'name': 'p1',
					'type': 'int'
				},
				{
					'name': 'p2',
					'type': 'varchar'
				}
			],
			outputs: [
				{
					'name': 'o1',
					'type': 'int'
				},
			]
		};
		testContext.modelClient.setup(x => x.loadModelParameters(TypeMoq.It.isAny())).returns(() => Promise.resolve(expected));
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		const actual = await service.loadModelParameters('');
		should.deepEqual(actual, expected);
	});

	it('downloadModel should download model successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		const tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
		await fs.promises.writeFile(tempFilePath, 'test');
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const model: RegisteredModel =
		{
			id: 1,
			artifactName: 'name1',
			title: 'title1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: testContext.importTable
		};
		const result = {
			rowCount: 1,
			columnInfo: [],
			rows: [
				[
					{
						displayValue: await utils.readFileInHex(tempFilePath),
						isNull: false,
						invariantCultureDisplayValue: ''
					}
				]
			]
		};
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));

		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'db');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'table');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		const actual = await service.downloadModel(model);
		should.notEqual(actual, undefined);
	});

	it('deployLocalModel should returns models successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const model: RegisteredModel =
		{
			id: 1,
			artifactName: 'name1',
			title: 'title1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: testContext.importTable
		};
		const row = [
			{
				displayValue: '1',
				isNull: false,
				invariantCultureDisplayValue: ''
			},
			{
				displayValue: 'name1',
				isNull: false,
				invariantCultureDisplayValue: ''
			},
			{
				displayValue: 'title1',
				isNull: false,
				invariantCultureDisplayValue: ''
			},
			{
				displayValue: 'desc1',
				isNull: false,
				invariantCultureDisplayValue: ''
			},
			{
				displayValue: '1.1',
				isNull: false,
				invariantCultureDisplayValue: ''
			},
			{
				displayValue: '2018-01-01',
				isNull: false,
				invariantCultureDisplayValue: ''
			}
		];
		const result = {
			rowCount: 1,
			columnInfo: [],
			rows: [row]
		};
		let updatedResult = {
			rowCount: 1,
			columnInfo: [],
			rows: [row, row]
		};
		let deployed = false;
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);

		testContext.queryRunner.setup(x => x.runWithDatabaseChange(TypeMoq.It.isAny(), TypeMoq.It.is(x => x.indexOf('Insert into') > 0), TypeMoq.It.isAny())).returns(() => {
			deployed = true;
			return Promise.resolve(result);
		});
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
			return deployed ? Promise.resolve(updatedResult) : Promise.resolve(result);
		});
		testContext.queryRunner.setup(x => x.runWithDatabaseChange(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));

		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'db');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'table');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		let tempFilePath: string = '';
		try {
			tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
			await fs.promises.writeFile(tempFilePath, 'test');
			await should(service.deployLocalModel(tempFilePath, model, testContext.importTable)).resolved();
		}
		finally {
			await utils.deleteFile(tempFilePath);
		}
	});

	it('getConfigureQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);

		testContext.importTable.databaseName = 'd[]b';
		testContext.importTable.tableName = 'ta[b]le';
		testContext.importTable.schema = 'dbo';
		const expected = `
		IF EXISTS
			(  SELECT t.name, s.name
				FROM sys.tables t join sys.schemas s on t.schema_id=t.schema_id
				WHERE t.name = 'ta[b]le'
				AND s.name = 'dbo'
			)
		BEGIN
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='artifact_name')
				ALTER TABLE [dbo].[ta[[b]]le] ADD [artifact_name] [varchar](256) NOT NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='artifact_content')
				ALTER TABLE [dbo].[ta[[b]]le] ADD [artifact_content] [varbinary](max) NOT NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='name')
				ALTER TABLE [dbo].[ta[[b]]le] ADD [name] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='version')
				ALTER TABLE [dbo].[ta[[b]]le] ADD [version] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='created')
			BEGIN
				ALTER TABLE [dbo].[ta[[b]]le] ADD [created] [datetime] NULL
				ALTER TABLE [dbo].[ta[[b]]le] ADD CONSTRAINT CONSTRAINT_NAME DEFAULT GETDATE() FOR created
			END
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='description')
				ALTER TABLE [dbo].[ta[[b]]le] ADD [description] [varchar](256) NULL
		END
		Else
		BEGIN
		CREATE TABLE [dbo].[ta[[b]]le](
			[artifact_id] [int] IDENTITY(1,1) NOT NULL,
			[artifact_name] [varchar](256) NOT NULL,
			[artifact_content] [varbinary](max) NOT NULL,
			[artifact_initial_size] [bigint] NULL,
			[name] [varchar](256) NULL,
			[version] [varchar](256) NULL,
			[created] [datetime] NULL,
			[description] [varchar](256) NULL,
		CONSTRAINT [ta[[b]]le_artifact_pk] PRIMARY KEY CLUSTERED
		(
			[artifact_id] ASC
		)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
		) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
		ALTER TABLE [dbo].[ta[[b]]le] ADD  CONSTRAINT [CONSTRAINT_NAME]  DEFAULT (getdate()) FOR [created]
		END
	`;
		const actual = service.getConfigureTableQuery(testContext.importTable);
		should.equal(actual.indexOf(expected) >= 0, true, `actual: ${actual} \n expected: ${expected}`);
	});

	it('getDeployedModelsQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		testContext.importTable.databaseName = 'd[]b';
		testContext.importTable.tableName = 'ta[b]le';
		testContext.importTable.schema = 'dbo';
		const expected = `
		SELECT artifact_id, artifact_name, name, description, version, created
		FROM [d[[]]b].[dbo].[ta[[b]]le]
		WHERE artifact_name not like 'MLmodel' and artifact_name not like 'conda.yaml'
		Order by artifact_id
		`;
		const actual = service.getDeployedModelsQuery(testContext.importTable);
		should.deepEqual(expected, actual);
	});

	it('getInsertModelQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		const model: RegisteredModel =
		{
			id: 1,
			artifactName: 'name1',
			title: 'title1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: testContext.importTable
		};

		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);

		const expected = `
		Insert into [dbo].[tb]
		(artifact_name, artifact_content, name, version, description)
		values (
			'name1',
			,
			'title1',
			'1.1',
			'desc1')`;
		const actual = service.getInsertModelQuery(model, testContext.importTable);
		should.equal(actual.indexOf(expected) > 0, true);
	});

	it('getModelContentQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		const model: RegisteredModel =
		{
			id: 1,
			artifactName: 'name1',
			title: 'title1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: testContext.importTable
		};

		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		model.table = {
			databaseName: 'd[]b', tableName: 'ta[b]le', schema: 'dbo'
		};
		const expected = `
		SELECT artifact_content
		FROM [d[[]]b].[dbo].[ta[[b]]le]
		WHERE artifact_id = 1;
		`;
		const actual = service.getModelContentQuery(model);
		should.deepEqual(actual, expected);
	});
});
