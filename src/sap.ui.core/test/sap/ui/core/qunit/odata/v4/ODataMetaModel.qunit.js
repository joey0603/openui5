/*!
 * ${copyright}
 */
sap.ui.define([
	"jquery.sap.global",
	"sap/base/Log",
	"sap/ui/base/SyncPromise",
	"sap/ui/model/BindingMode",
	"sap/ui/model/ChangeReason",
	"sap/ui/model/ClientListBinding",
	"sap/ui/model/Context",
	"sap/ui/model/ContextBinding",
	"sap/ui/model/Filter",
	"sap/ui/model/MetaModel",
	"sap/ui/model/PropertyBinding",
	"sap/ui/model/Sorter",
	"sap/ui/model/odata/OperationMode",
	"sap/ui/model/odata/type/Int64",
	"sap/ui/model/odata/type/Raw",
	"sap/ui/model/odata/v4/AnnotationHelper",
	"sap/ui/model/odata/v4/Context",
	"sap/ui/model/odata/v4/ODataMetaModel",
	"sap/ui/model/odata/v4/ODataModel",
	"sap/ui/model/odata/v4/ValueListType",
	"sap/ui/model/odata/v4/lib/_Helper",
	"sap/ui/test/TestUtils",
	"sap/ui/thirdparty/URI"
], function (jQuery, Log, SyncPromise, BindingMode, ChangeReason, ClientListBinding, BaseContext,
		ContextBinding, Filter, MetaModel, PropertyBinding, Sorter, OperationMode, Int64, Raw,
		AnnotationHelper, Context, ODataMetaModel, ODataModel, ValueListType, _Helper, TestUtils,
		URI) {
	/*global QUnit, sinon */
	/*eslint max-nested-callbacks: 0, no-loop-func: 0, no-warning-comments: 0 */
	"use strict";

	// Common := com.sap.vocabularies.Common.v1
	// tea_busi := com.sap.gateway.default.iwbep.tea_busi.v0001
	// tea_busi_product.v0001 := com.sap.gateway.default.iwbep.tea_busi_product.v0001
	// tea_busi_supplier.v0001 := com.sap.gateway.default.iwbep.tea_busi_supplier.v0001
	// UI := com.sap.vocabularies.UI.v1
	var mMostlyEmptyScope = {
			"$EntityContainer" : "empty.DefaultContainer",
			"$Version" : "4.0",
			"empty." : {
				"$kind" : "Schema"
			},
			"empty.DefaultContainer" : {
				"$kind" : "EntityContainer"
			}
		},
		sODataMetaModel = "sap.ui.model.odata.v4.ODataMetaModel",
		mProductScope = {
			"$EntityContainer" : "tea_busi_product.v0001.DefaultContainer",
			"$Reference" : {
				"../../../../default/iwbep/tea_busi_supplier/0001/$metadata" : {
					"$Include" : [
						"tea_busi_supplier.v0001."
					]
				}
			},
			"$Version" : "4.0",
			"tea_busi_product.v0001." : {
				"$kind" : "Schema",
				"$Annotations" : { // Note: simulate result of _MetadataRequestor#read
					"tea_busi_product.v0001.Category/CategoryName" : {
						"@Common.Label" : "CategoryName from tea_busi_product.v0001."
					}
				}
			},
			"tea_busi_product.v0001.Category" : {
				"$kind" : "EntityType",
				"CategoryName" : {
					"$kind" : "Property",
					"$Type" : "Edm.String"
				}
			},
			"tea_busi_product.v0001.DefaultContainer" : {
				"$kind" : "EntityContainer"
			},
			"tea_busi_product.v0001.Product" : {
				"$kind" : "EntityType",
				"Name" : {
					"$kind" : "Property",
					"$Type" : "Edm.String"
				},
				"PRODUCT_2_CATEGORY" : {
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi_product.v0001.Category"
				},
				"PRODUCT_2_SUPPLIER" : {
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi_supplier.v0001.Supplier"
				}
			}
		},
		sSampleServiceUrl
			= "/sap/opu/odata4/sap/zui5_testv4/default/sap/zui5_epm_sample/0002/",
		mScope = {
			"$Annotations" : {
				"name.space.Id" : {
					"@Common.Label" : "ID"
				},
				"tea_busi.DefaultContainer" : {
					"@DefaultContainer" : {}
				},
				"tea_busi.DefaultContainer/T€AMS" : {
					"@T€AMS" : {}
				},
				"tea_busi.TEAM" : {
					"@Common.Text" : {
						"$Path" : "Name"
					},
					"@Common.Text@UI.TextArrangement" : {
						"$EnumMember" : "UI.TextArrangementType/TextLast"
					},
					"@UI.Badge" : {
						"@Common.Label" : "Label inside",
						"$Type" : "UI.BadgeType",
						"HeadLine" : {
							"$Type" : "UI.DataField",
							"Value" : {
								"$Path" : "Name"
							}
						},
						"Title" : {
							"$Type" : "UI.DataField",
							"Value" : {
								"$Path" : "Team_Id"
							}
						}
					},
					"@UI.Badge@Common.Label" : "Best Badge Ever!",
					"@UI.LineItem" : [{
						"@UI.Importance" : {
							"$EnumMember" : "UI.ImportanceType/High"
						},
						"$Type" : "UI.DataField",
						"Label" : "Team ID",
						"Label@Common.Label" : "Team ID's Label",
						"Value" : {
							"$Path" : "Team_Id"
						}
					}]
				},
				"tea_busi.TEAM/Team_Id" : {
					"@Common.Label" : "Team ID",
					"@Common.Text" : {
						"$Path" : "Name"
					},
					"@Common.Text@UI.TextArrangement" : {
						"$EnumMember" : "UI.TextArrangementType/TextLast"
					}
				},
				"tea_busi.Worker" : {
					"@UI.Facets" : [{
						"$Type" : "UI.ReferenceFacet",
						"Target" : {
							// term cast
							"$AnnotationPath" : "@UI.LineItem"
						}
					}, {
						"$Type" : "UI.ReferenceFacet",
						"Target" : {
							// term cast at navigation property itself
							"$AnnotationPath" : "EMPLOYEE_2_TEAM@Common.Label"
						}
					}, {
						"$Type" : "UI.ReferenceFacet",
						"Target" : {
							// navigation property and term cast
							"$AnnotationPath" : "EMPLOYEE_2_TEAM/@UI.LineItem"
						}
					}, {
						"$Type" : "UI.ReferenceFacet",
						"Target" : {
							// type cast, navigation properties and term cast (at its type)
							"$AnnotationPath"
								: "tea_busi.TEAM/TEAM_2_EMPLOYEES/EMPLOYEE_2_TEAM/@UI.LineItem"
						}
					}],
					"@UI.LineItem" : [{
						"$Type" : "UI.DataField",
						"Label" : "Team ID",
						"Value" : {
							"$Path" : "EMPLOYEE_2_TEAM/Team_Id"
						}
					}]
				},
				"tea_busi.Worker/EMPLOYEE_2_TEAM" : {
					"@Common.Label" : "Employee's Team"
				}
			},
			"$EntityContainer" : "tea_busi.DefaultContainer",
			"empty." : {
				"$kind" : "Schema"
			},
			"name.space." : {
				"$kind" : "Schema"
			},
			"tea_busi." : {
				"$kind" : "Schema",
				"@Schema" : {}
			},
			"empty.Container" : {
				"$kind" : "EntityContainer"
			},
			"name.space.BadContainer" : {
				"$kind" : "EntityContainer",
				"DanglingActionImport" : {
					"$kind" : "ActionImport",
					"$Action" : "not.Found"
				},
				"DanglingFunctionImport" : {
					"$kind" : "FunctionImport",
					"$Function" : "not.Found"
				}
			},
			"name.space.Broken" : {
				"$kind" : "Term",
				"$Type" : "not.Found"
			},
			"name.space.BrokenFunction" : [{
				"$kind" : "Function",
				"$ReturnType" : {
					"$Type" : "not.Found"
				}
			}],
			"name.space.BrokenOverloads" : [{
				"$kind" : "Operation"
			}],
			"name.space.DerivedPrimitiveFunction" : [{
				"$kind" : "Function",
				"$ReturnType" : {
					"$Type" : "name.space.Id"
				}
			}],
			"name.space.EmptyOverloads" : [],
			"name.space.Id" : {
				"$kind" : "TypeDefinition",
				"$UnderlyingType" : "Edm.String",
				"$MaxLength" : 10
			},
			"name.space.Term" : { // only case with a qualified name and a $Type
				"$kind" : "Term",
				"$Type" : "tea_busi.Worker"
			},
			"name.space.OverloadedAction" : [{
				"$kind" : "Action",
				"$IsBound" : true,
				"$Parameter" : [{
//					"$Name" : "_it",
					"$Type" : "tea_busi.EQUIPMENT"
				}],
				"$ReturnType" : {
					"$Type" : "tea_busi.EQUIPMENT"
				}
			}, {
				"$kind" : "Action",
				"$IsBound" : true,
				"$Parameter" : [{
//					"$Name" : "_it",
					"$Type" : "tea_busi.TEAM"
				}],
				"$ReturnType" : {
					"$Type" : "tea_busi.TEAM"
				}
			}, { // "An unbound action MAY have the same name as a bound action."
				"$kind" : "Action",
				"$ReturnType" : {
					"$Type" : "tea_busi.ComplexType_Salary"
				}
			}, {
				"$kind" : "Action",
				"$IsBound" : true,
				"$Parameter" : [{
//					"$Name" : "_it",
					"$Type" : "tea_busi.Worker"
				}],
				"$ReturnType" : {
					"$Type" : "tea_busi.Worker"
				}
			}],
			"name.space.OverloadedFunction" : [{
				"$kind" : "Function",
				"$ReturnType" : {
					"$Type" : "Edm.String"
				}
			}, {
				"$kind" : "Function",
				"$ReturnType" : {
					"$Type" : "Edm.String"
				}
			}],
			"name.space.VoidAction" : [{
				"$kind" : "Action"
			}],
			"tea_busi.AcChangeManagerOfTeam" : [{
				"$kind" : "Action",
				"$ReturnType" : {
					"$Type" : "tea_busi.TEAM",
					"@Common.Label" : "Hail to the Chief"
				}
			}],
			"tea_busi.ComplexType_Salary" : {
				"$kind" : "ComplexType",
				"AMOUNT" : {
					"$kind" : "Property",
					"$Type" : "Edm.Decimal"
				},
				"CURRENCY" : {
					"$kind" : "Property",
					"$Type" : "Edm.String"
				}
			},
			"tea_busi.ContainedC" : {
				"$kind" : "EntityType",
				"$Key" : ["Id"],
				"Id" : {
					"$kind" : "Property",
					"$Type" : "Edm.String"
				},
				"C_2_EMPLOYEE" : {
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi.Worker"
				},
				"C_2_S" : {
					"$ContainsTarget" : true,
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi.ContainedS"
				}
			},
			"tea_busi.ContainedS" : {
				"$kind" : "EntityType",
				"$Key" : ["Id"],
				"Id" : {
					"$kind" : "Property",
					"$Type" : "Edm.String"
				},
				"S_2_C" : {
					"$ContainsTarget" : true,
					"$kind" : "NavigationProperty",
					"$isCollection" : true,
					"$Type" : "tea_busi.ContainedC"
				},
				"S_2_EMPLOYEE" : {
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi.Worker"
				}
			},
			"tea_busi.DefaultContainer" : {
				"$kind" : "EntityContainer",
				"ChangeManagerOfTeam" : {
					"$kind" : "ActionImport",
					"$Action" : "tea_busi.AcChangeManagerOfTeam"
				},
				"EMPLOYEES" : {
					"$kind" : "EntitySet",
					"$NavigationPropertyBinding" : {
						"EMPLOYEE_2_TEAM" : "T€AMS",
						"EMPLOYEE_2_EQUIPM€NTS" : "EQUIPM€NTS"
					},
					"$Type" : "tea_busi.Worker"
				},
				"EQUIPM€NTS" : {
					"$kind" : "EntitySet",
					"$Type" : "tea_busi.EQUIPMENT"
				},
				"GetEmployeeMaxAge" : {
					"$kind" : "FunctionImport",
					"$Function" : "tea_busi.FuGetEmployeeMaxAge"
				},
				"Me" : {
					"$kind" : "Singleton",
					"$NavigationPropertyBinding" : {
						"EMPLOYEE_2_TEAM" : "T€AMS",
						"EMPLOYEE_2_EQUIPM€NTS" : "EQUIPM€NTS"
					},
					"$Type" : "tea_busi.Worker"
				},
				"OverloadedAction" : {
					"$kind" : "ActionImport",
					"$Action" : "name.space.OverloadedAction"
				},
				"TEAMS" : {
					"$kind" : "EntitySet",
					"$NavigationPropertyBinding" : {
						"TEAM_2_EMPLOYEES" : "EMPLOYEES",
						"TEAM_2_CONTAINED_S/S_2_EMPLOYEE" : "EMPLOYEES"
					},
					"$Type" : "tea_busi.TEAM"
				},
				"T€AMS" : {
					"$kind" : "EntitySet",
					"$NavigationPropertyBinding" : {
						"TEAM_2_EMPLOYEES" : "EMPLOYEES"
					},
					"$Type" : "tea_busi.TEAM"
				},
				"VoidAction" : {
					"$kind" : "ActionImport",
					"$Action" : "name.space.VoidAction"
				}
			},
			"tea_busi.EQUIPMENT" : {
				"$kind" : "EntityType",
				"$Key" : ["ID"],
				"ID" : {
					"$kind" : "Property",
					"$Type" : "Edm.Int32",
					"$Nullable" : false
				}
			},
			"tea_busi.FuGetEmployeeMaxAge" : [{
				"$kind" : "Function",
				"$ReturnType" : {
					"$Type" : "Edm.Int16"
				}
			}],
			"tea_busi.TEAM" : {
				"$kind" : "EntityType",
				"$Key" : ["Team_Id"],
				"Team_Id" : {
					"$kind" : "Property",
					"$Type" : "name.space.Id",
					"$Nullable" : false,
					"$MaxLength" : 10
				},
				"Name" : {
					"$kind" : "Property",
					"$Type" : "Edm.String",
					"$Nullable" : false,
					"$MaxLength" : 40
				},
				"TEAM_2_EMPLOYEES" : {
					"$kind" : "NavigationProperty",
					"$isCollection" : true,
					"$OnDelete" : "None",
					"$OnDelete@Common.Label" : "None of my business",
					"$ReferentialConstraint" : {
						"foo" : "bar",
						"foo@Common.Label" : "Just a Gigolo"
					},
					"$Type" : "tea_busi.Worker"
				},
				"TEAM_2_CONTAINED_S" : {
					"$ContainsTarget" : true,
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi.ContainedS"
				},
				"TEAM_2_CONTAINED_C" : {
					"$ContainsTarget" : true,
					"$kind" : "NavigationProperty",
					"$isCollection" : true,
					"$Type" : "tea_busi.ContainedC"
				},
				// Note: "value" is a symbolic name for an operation's return type iff. it is
				// primitive
				"value" : {
					"$kind" : "Property",
					"$Type" : "Edm.String"
				}
			},
			"tea_busi.Worker" : {
				"$kind" : "EntityType",
				"$Key" : ["ID"],
				"ID" : {
					"$kind" : "Property",
					"$Type" : "Edm.String",
					"$Nullable" : false,
					"$MaxLength" : 4
				},
				"AGE" : {
					"$kind" : "Property",
					"$Type" : "Edm.Int16",
					"$Nullable" : false
				},
				"EMPLOYEE_2_CONTAINED_S" : {
					"$ContainsTarget" : true,
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi.ContainedS"
				},
				"EMPLOYEE_2_EQUIPM€NTS" : {
					"$kind" : "NavigationProperty",
					"$isCollection" : true,
					"$Type" : "tea_busi.EQUIPMENT",
					"$Nullable" : false
				},
				"EMPLOYEE_2_TEAM" : {
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi.TEAM",
					"$Nullable" : false
				},
				"SALÃRY" : {
					"$kind" : "Property",
					"$Type" : "tea_busi.ComplexType_Salary"
				}
			},
			"$$Loop" : "$$Loop/", // some endless loop
			"$$Term" : "name.space.Term" // replacement for any reference to the term
		},
		oContainerData = mScope["tea_busi.DefaultContainer"],
		aOverloadedAction = mScope["name.space.OverloadedAction"],
		mSupplierScope = {
			"$Version" : "4.0",
			"tea_busi_supplier.v0001." : {
				"$kind" : "Schema"
			},
			"tea_busi_supplier.v0001.Supplier" : {
				"$kind" : "EntityType",
				"Supplier_Name" : {
					"$kind" : "Property",
					"$Type" : "Edm.String"
				}
			}
		},
		oTeamData = mScope["tea_busi.TEAM"],
		oTeamLineItem = mScope.$Annotations["tea_busi.TEAM"]["@UI.LineItem"],
		oWorkerData = mScope["tea_busi.Worker"],
		mXServiceScope = {
			"$Version" : "4.0",
			"$Annotations" : {}, // simulate ODataMetaModel#_mergeAnnotations
			"$EntityContainer" : "tea_busi.v0001.DefaultContainer",
			"$Reference" : {
				// Note: Do not reference tea_busi_supplier directly from here! We want to test the
				// special case that it is only indirectly referenced.
				"../../../../default/iwbep/tea_busi_foo/0001/$metadata" : {
					"$Include" : [
						"tea_busi_foo.v0001."
					]
				},
				"../../../../default/iwbep/tea_busi_product/0001/$metadata" : {
					"$Include" : [
						"ignore.me.",
						"tea_busi_product.v0001."
					]
				},
				"/empty/$metadata" : {
					"$Include" : [
						"empty.",
						"I.still.haven't.found.what.I'm.looking.for."
					]
				}
			},
			"tea_busi.v0001." : {
				"$kind" : "Schema"
			},
			"tea_busi.v0001.DefaultContainer" : {
				"$kind" : "EntityContainer",
				"EQUIPM€NTS" : {
					"$kind" : "EntitySet",
					"$Type" : "tea_busi.v0001.EQUIPMENT"
				}
			},
			"tea_busi.v0001.EQUIPMENT" : {
				"$kind" : "EntityType",
				"EQUIPMENT_2_PRODUCT" : {
					"$kind" : "NavigationProperty",
					"$Type" : "tea_busi_product.v0001.Product"
				}
			}
		},
		aAllScopes = [
			mMostlyEmptyScope,
			mProductScope,
			mScope,
			mSupplierScope,
			mXServiceScope
		];

	/**
	 * Checks the "get*" and "request*" methods corresponding to the named "fetch*" method,
	 * using the given arguments.
	 *
	 * @param {object} oTestContext
	 *   the QUnit "this" object
	 * @param {object} assert
	 *   the QUnit "assert" object
	 * @param {string} sMethodName
	 *   method name "fetch*"
	 * @param {object[]} aArguments
	 *   method arguments
	 * @param {boolean} [bThrow=false]
	 *   whether the "get*" method throws if the promise is not fulfilled
	 * @returns {Promise}
	 *   the "request*" method's promise
	 */
	function checkGetAndRequest(oTestContext, assert, sMethodName, aArguments, bThrow) {
		var oExpectation,
			sGetMethodName = sMethodName.replace("fetch", "get"),
			oMetaModel = oTestContext.oMetaModel,
			oReason = new Error("rejected"),
			oRejectedPromise = Promise.reject(oReason),
			sRequestMethodName = sMethodName.replace("fetch", "request"),
			oResult = {},
			oSyncPromise = SyncPromise.resolve(oRejectedPromise);

		// resolve...
		oExpectation = oTestContext.mock(oMetaModel).expects(sMethodName).exactly(4);
		oExpectation = oExpectation.withExactArgs.apply(oExpectation, aArguments);
		oExpectation.returns(SyncPromise.resolve(oResult));

		// get: fulfilled
		assert.strictEqual(oMetaModel[sGetMethodName].apply(oMetaModel, aArguments), oResult);

		// reject...
		oExpectation.returns(oSyncPromise);
		oTestContext.mock(Promise).expects("resolve")
			.withExactArgs(sinon.match.same(oSyncPromise))
			.returns(oRejectedPromise); // return any promise (this is not unwrapping!)

		// request (promise still pending!)
		assert.strictEqual(oMetaModel[sRequestMethodName].apply(oMetaModel, aArguments),
			oRejectedPromise);

		// get: pending
		if (bThrow) {
			assert.throws(function () {
				oMetaModel[sGetMethodName].apply(oMetaModel, aArguments);
			}, new Error("Result pending"));
		} else {
			assert.strictEqual(oMetaModel[sGetMethodName].apply(oMetaModel, aArguments), undefined,
				"pending");
		}
		return oSyncPromise.catch(function () {
			// get: rejected
			if (bThrow) {
				assert.throws(function () {
					oMetaModel[sGetMethodName].apply(oMetaModel, aArguments);
				}, oReason);
			} else {
				assert.strictEqual(oMetaModel[sGetMethodName].apply(oMetaModel, aArguments),
					undefined, "rejected");
			}
		});
	}

	/**
	 * Returns a clone, that is a deep copy, of the given object.
	 *
	 * @param {object} o
	 *   any serializable object
	 * @returns {object}
	 *   a deep copy of <code>o</code>
	 */
	function clone(o) {
		return JSON.parse(JSON.stringify(o));
	}

	/**
	 * Runs the given test for each name/value pair in the given fixture. The name is interpreted
	 * as a path "[<sContextPath>'|']<sMetaPath>" and cut accordingly. The test is called with
	 * an almost resolved sPath (just '|' replaced by '/').
	 *
	 * @param {object} mFixture
	 *   map<string, any>
	 * @param {function} fnTest
	 *   function(string sPath, any vResult, string sContextPath, string sMetaPath)
	 */
	function forEach(mFixture, fnTest) {
		var sPath;

		for (sPath in mFixture) {
			var i = sPath.indexOf("|"),
				sContextPath = "",
				sMetaPath = sPath.slice(i + 1),
				vValue = mFixture[sPath];

			if (i >= 0) {
				sContextPath = sPath.slice(0, i);
				sPath = sContextPath + "/" + sMetaPath;
			}

			fnTest(sPath, vValue, sContextPath, sMetaPath);
		}
	}

	//*********************************************************************************************
	QUnit.module("sap.ui.model.odata.v4.ODataMetaModel", {
		// remember copy to ensure test isolation
		mOriginalScopes : clone(aAllScopes),

		afterEach : function (assert) {
			assert.deepEqual(aAllScopes, this.mOriginalScopes, "metadata unchanged");
		},

		/*
		 * Allow warnings if told to; always suppress debug messages.
		 */
		allowWarnings : function (assert, bWarn) {
			this.mock(Log).expects("isLoggable").atLeast(1)
				.withExactArgs(sinon.match.number, sODataMetaModel)
				.callsFake(function (iLogLevel) {
					switch (iLogLevel) {
						case Log.Level.DEBUG:
							return false;

						case Log.Level.WARNING:
							return bWarn;

						default:
							return true;
					}
				});
		},

		beforeEach : function () {
			var oMetadataRequestor = {
					read : function () { throw new Error(); }
				},
				sUrl = "/a/b/c/d/e/$metadata";

			this.oLogMock = this.mock(Log);
			this.oLogMock.expects("warning").never();
			this.oLogMock.expects("error").never();

			this.oModel = {
				reportError : function () {
					throw new Error("Unsupported operation");
				},
				resolve : ODataModel.prototype.resolve
			};
			this.oMetaModel = new ODataMetaModel(oMetadataRequestor, sUrl, undefined, this.oModel);
			this.oMetaModelMock = this.mock(this.oMetaModel);
		},

		/*
		 * Expect the given debug message with the given path, but only if debug level is on.
		 */
		expectDebug : function (bDebug, sMessage, sPath) {
			this.oLogMock.expects("isLoggable")
				.withExactArgs(Log.Level.DEBUG, sODataMetaModel).returns(bDebug);
			this.oLogMock.expects("debug").exactly(bDebug ? 1 : 0)
				.withExactArgs(sMessage, sPath, sODataMetaModel);
		},

		/*
		 * Expects "fetchEntityContainer" to be called at least once on the current meta model,
		 * returning a clone of the given scope.
		 *
		 * @param {object} mScope
		 */
		expectFetchEntityContainer : function (mScope) {
			mScope = clone(mScope);
			this.oMetaModel.validate("n/a", mScope); // fill mSchema2MetadataUrl!
			this.oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
				.returns(SyncPromise.resolve(mScope));
		}
	});

	//*********************************************************************************************
	QUnit.test("basics", function (assert) {
		var sAnnotationUri = "my/annotation.xml",
			aAnnotationUris = [ sAnnotationUri, "uri2.xml"],
			oModel = {},
			oMetadataRequestor = this.oMetaModel.oRequestor,
			sUrl = "/~/$metadata",
			oMetaModel;

		// code under test
		assert.strictEqual(ODataMetaModel.prototype.$$valueAsPromise, true);

		// code under test
		oMetaModel = new ODataMetaModel(oMetadataRequestor, sUrl);

		assert.ok(oMetaModel instanceof MetaModel);
		assert.strictEqual(oMetaModel.aAnnotationUris, undefined);
		assert.ok(oMetaModel.hasOwnProperty("aAnnotationUris"), "own property aAnnotationUris");
		assert.strictEqual(oMetaModel.oRequestor, oMetadataRequestor);
		assert.strictEqual(oMetaModel.sUrl, sUrl);
		assert.strictEqual(oMetaModel.getDefaultBindingMode(), BindingMode.OneTime);
		assert.strictEqual(oMetaModel.toString(),
			"sap.ui.model.odata.v4.ODataMetaModel: /~/$metadata");

		// code under test
		oMetaModel.setDefaultBindingMode(BindingMode.OneWay);
		assert.strictEqual(oMetaModel.getDefaultBindingMode(), BindingMode.OneWay);

		// code under test
		oMetaModel = new ODataMetaModel(oMetadataRequestor, sUrl, aAnnotationUris);

		assert.strictEqual(oMetaModel.aAnnotationUris, aAnnotationUris, "arrays are passed");

		// code under test
		oMetaModel = new ODataMetaModel(oMetadataRequestor, sUrl, sAnnotationUri);

		assert.deepEqual(oMetaModel.aAnnotationUris, [sAnnotationUri],
			"single annotation is wrapped");

		// code under test
		oMetaModel = new ODataMetaModel(null, null, null, oModel);

		// code under test
		assert.strictEqual(oMetaModel.getAdapterFactoryModulePath(),
			"sap/ui/mdc/experimental/adapter/odata/v4/ODataAdapterFactory");
	});

	//*********************************************************************************************
	QUnit.test("forbidden", function (assert) {
		assert.throws(function () { //TODO implement
			this.oMetaModel.bindTree();
		}, new Error("Unsupported operation: v4.ODataMetaModel#bindTree"));

		assert.throws(function () {
			this.oMetaModel.getOriginalProperty();
		}, new Error("Unsupported operation: v4.ODataMetaModel#getOriginalProperty"));

		assert.throws(function () { //TODO implement
			this.oMetaModel.isList();
		}, new Error("Unsupported operation: v4.ODataMetaModel#isList"));

		assert.throws(function () {
			this.oMetaModel.refresh();
		}, new Error("Unsupported operation: v4.ODataMetaModel#refresh"));

		assert.throws(function () {
			this.oMetaModel.setLegacySyntax(); // argument does not matter!
		}, new Error("Unsupported operation: v4.ODataMetaModel#setLegacySyntax"));

		assert.throws(function () {
			this.oMetaModel.setDefaultBindingMode(BindingMode.TwoWay);
		});
	});

	//*********************************************************************************************
	[
		undefined,
		["/my/annotation.xml"],
		["/my/annotation.xml", "/another/annotation.xml"]
	].forEach(function (aAnnotationURI) {
		var title = "fetchEntityContainer - " + JSON.stringify(aAnnotationURI);
		QUnit.test(title, function (assert) {
			var oRequestorMock = this.mock(this.oMetaModel.oRequestor),
				aReadResults,
				mRootScope = {},
				oSyncPromise,
				that = this;

			function expectReads(bPrefetch) {
				oRequestorMock.expects("read")
					.withExactArgs(that.oMetaModel.sUrl, false, bPrefetch)
					.returns(Promise.resolve(mRootScope));
				aReadResults = [];
				(aAnnotationURI || []).forEach(function (sAnnotationUrl) {
					var oAnnotationResult = {};

					aReadResults.push(oAnnotationResult);
					oRequestorMock.expects("read")
						.withExactArgs(sAnnotationUrl, true, bPrefetch)
						.returns(Promise.resolve(oAnnotationResult));
				});
			}

			this.oMetaModel.aAnnotationUris = aAnnotationURI;
			this.oMetaModelMock.expects("_mergeAnnotations").never();
			expectReads(true);

			// code under test
			assert.strictEqual(this.oMetaModel.fetchEntityContainer(true), null);

			// bPrefetch => no caching
			expectReads(true);

			// code under test
			assert.strictEqual(this.oMetaModel.fetchEntityContainer(true), null);

			// now test [bPrefetch=false]
			expectReads();
			this.oMetaModelMock.expects("_mergeAnnotations")
				.withExactArgs(mRootScope, aReadResults);

			// code under test
			oSyncPromise = this.oMetaModel.fetchEntityContainer();

			// pending
			assert.strictEqual(oSyncPromise.isPending(), true);
			// already caching
			assert.strictEqual(this.oMetaModel.fetchEntityContainer(), oSyncPromise);
			assert.strictEqual(this.oMetaModel.fetchEntityContainer(true), oSyncPromise,
				"now bPrefetch makes no difference");

			return oSyncPromise.then(function (mRootScope0) {
				assert.strictEqual(mRootScope0, mRootScope);
				// still caching
				assert.strictEqual(that.oMetaModel.fetchEntityContainer(), oSyncPromise);
			});
		});
	});
	//TODO later support "$Extends" : "<13.1.2 EntityContainer Extends>"

	//*********************************************************************************************
	QUnit.test("fetchEntityContainer: _mergeAnnotations fails", function (assert) {
		var oError = new Error();

		this.mock(this.oMetaModel.oRequestor).expects("read")
			.withExactArgs(this.oMetaModel.sUrl, false, undefined)
			.returns(Promise.resolve({}));
		this.oMetaModelMock.expects("_mergeAnnotations").throws(oError);

		return this.oMetaModel.fetchEntityContainer().then(function () {
			assert.ok(false, "unexpected success");
		}, function (oError0) {
			assert.strictEqual(oError0, oError);
		});
	});

	//*********************************************************************************************
	QUnit.test("getMetaContext", function (assert) {
		var oMetaContext;

		this.oMetaModelMock.expects("getMetaPath")
			.withExactArgs("/Foo/-1/bar")
			.returns("/Foo/bar");

		// code under test
		oMetaContext = this.oMetaModel.getMetaContext("/Foo/-1/bar");

		assert.strictEqual(oMetaContext.getModel(), this.oMetaModel);
		assert.strictEqual(oMetaContext.getPath(), "/Foo/bar");
	});

	//*********************************************************************************************
	QUnit.test("getMetaPath", function (assert) {
		var sMetaPath = {},
			sPath = {};

		this.mock(_Helper).expects("getMetaPath")
			.withExactArgs(sinon.match.same(sPath)).returns(sMetaPath);

		assert.strictEqual(this.oMetaModel.getMetaPath(sPath), sMetaPath);
	});

	//*********************************************************************************************
	forEach({
		// absolute path
		"/" : "/",
		"/foo/bar|/" : "/", // context is ignored
		// relative path
		"" : undefined, // w/o context --> important for MetaModel#createBindingContext etc.
		"|foo/bar" : undefined, // w/o context
		"/|" : "/",
		"/|foo/bar" : "/foo/bar",
		"/foo|bar" : "/foo/bar",
		"/foo/bar|" : "/foo/bar",
		"/foo/|bar" : "/foo/bar",
		// trailing slash is preserved
		"/foo/bar/" : "/foo/bar/",
		"/foo|bar/" : "/foo/bar/",
		// relative path that starts with a dot
		"/foo/bar|./" : "/foo/bar/",
		"/foo|./bar/" : "/foo/bar/",
		"/foo/|./bar/" : "/foo/bar/",
		// annotations
		"/foo|@bar" : "/foo@bar",
		"/foo/|@bar" : "/foo/@bar",
		"/foo|./@bar" : "/foo/@bar",
		"/foo/|./@bar" : "/foo/@bar",
		// technical properties
		"/foo|$kind" : "/foo/$kind",
		"/foo/|$kind" : "/foo/$kind",
		"/foo|./$kind" : "/foo/$kind",
		"/foo/|./$kind" : "/foo/$kind"
	}, function (sPath, sResolvedPath, sContextPath, sMetaPath) {
		QUnit.test("resolve: " + sContextPath + " > " + sMetaPath, function (assert) {
			var oContext = sContextPath && this.oMetaModel.getContext(sContextPath);

			assert.strictEqual(this.oMetaModel.resolve(sMetaPath, oContext), sResolvedPath);
		});
	});
	//TODO make sure that Context objects are only created for absolute paths?!

	//*********************************************************************************************
	[".bar", ".@bar", ".$kind"].forEach(function (sPath) {
		QUnit.test("resolve: unsupported relative path " + sPath, function (assert) {
			var oContext = this.oMetaModel.getContext("/foo");

			assert.raises(function () {
				this.oMetaModel.resolve(sPath, oContext);
			}, new Error("Unsupported relative path: " + sPath));
		});
	});

	//*********************************************************************************************
	QUnit.test("resolve: undefined", function (assert) {
		assert.strictEqual(
			this.oMetaModel.resolve(undefined, this.oMetaModel.getContext("/")),
			"/");
	});

	//*********************************************************************************************
	//TODO better map meta model path to pure JSON path (look up inside JsonModel)?
	// what about @sapui.name then, which requires a literal as expected result?
	// --> we could distinguish "/<path>" from "<literal>"
	forEach({
		// "JSON" drill-down ----------------------------------------------------------------------
		"/$EntityContainer" : "tea_busi.DefaultContainer",
		"/tea_busi./$kind" : "Schema",
		"/tea_busi.DefaultContainer/$kind" : "EntityContainer",
		// trailing slash: object vs. name --------------------------------------------------------
		"/" : oContainerData,
		"/$EntityContainer/" : oContainerData,
		"/T€AMS/" : oTeamData,
		"/T€AMS/$Type/" : oTeamData,
		// scope lookup ("17.3 QualifiedName") ----------------------------------------------------
		"/$EntityContainer/$kind" : "EntityContainer",
		"/$EntityContainer/T€AMS/$Type" : "tea_busi.TEAM",
		"/$EntityContainer/T€AMS/$Type/Team_Id" : oTeamData.Team_Id,
		// "17.3 QualifiedName", e.g. type cast ---------------------------------------------------
		"/tea_busi." : mScope["tea_busi."], // access to schema
		"/tea_busi.DefaultContainer/EMPLOYEES/tea_busi.Worker/AGE" : oWorkerData.AGE,
		// implicit $Type insertion ---------------------------------------------------------------
		"/T€AMS/Team_Id" : oTeamData.Team_Id,
		"/T€AMS/TEAM_2_EMPLOYEES" : oTeamData.TEAM_2_EMPLOYEES,
		"/T€AMS/TEAM_2_EMPLOYEES/AGE" : oWorkerData.AGE,
		// scope lookup, then implicit $Type insertion!
		"/$$Term/AGE" : oWorkerData.AGE,
		// "17.2 SimpleIdentifier": lookup inside current schema child ----------------------------
		"/T€AMS" : oContainerData["T€AMS"],
		"/T€AMS/$NavigationPropertyBinding/TEAM_2_EMPLOYEES/" : oWorkerData,
		"/T€AMS/$NavigationPropertyBinding/TEAM_2_EMPLOYEES/$Type" : "tea_busi.Worker",
		"/T€AMS/$NavigationPropertyBinding/TEAM_2_EMPLOYEES/AGE" : oWorkerData.AGE,
		// operations -----------------------------------------------------------------------------
		"/OverloadedAction" : oContainerData["OverloadedAction"],
		"/OverloadedAction/$Action" : "name.space.OverloadedAction",
		"/ChangeManagerOfTeam/" : oTeamData,
		//TODO mScope[mScope["..."][0].$ReturnType.$Type] is where the next OData simple identifier
		//     would live in case of entity/complex type, but we would like to avoid warnings for
		//     primitive types - how to tell the difference?
//		"/GetEmployeeMaxAge/" : "Edm.Int16",
		// Note: "value" is a symbolic name for the whole return type iff. it is primitive
		"/GetEmployeeMaxAge/value" : mScope["tea_busi.FuGetEmployeeMaxAge"][0].$ReturnType,
		"/GetEmployeeMaxAge/value/$Type" : "Edm.Int16", // path may continue!
		"/tea_busi.FuGetEmployeeMaxAge/value"
			: mScope["tea_busi.FuGetEmployeeMaxAge"][0].$ReturnType,
		"/name.space.DerivedPrimitiveFunction/value"
			//TODO merge facets of return type and type definition?!
			: mScope["name.space.DerivedPrimitiveFunction"][0].$ReturnType,
		"/ChangeManagerOfTeam/value" : oTeamData.value,
		// action overloads -----------------------------------------------------------------------
		//TODO @$ui5.overload: support for split segments? etc.
		"/OverloadedAction/@$ui5.overload" : sinon.match.array.deepEquals([aOverloadedAction[2]]),
		"/OverloadedAction/@$ui5.overload/0" : aOverloadedAction[2],
		// Note: trailing slash does not make a difference in "JSON" drill-down
		"/OverloadedAction/@$ui5.overload/0/$ReturnType/" : aOverloadedAction[2].$ReturnType,
		"/OverloadedAction/@$ui5.overload/0/$ReturnType/$Type" : "tea_busi.ComplexType_Salary",
		"/OverloadedAction/" : mScope["tea_busi.ComplexType_Salary"],
		"/name.space.OverloadedAction" : aOverloadedAction,
		"/T€AMS/NotFound/name.space.OverloadedAction" : aOverloadedAction,
		"/name.space.OverloadedAction/1" : aOverloadedAction[1],
		"/OverloadedAction/$Action/1" : aOverloadedAction[1],
		"/OverloadedAction/@$ui5.overload/AMOUNT" : mScope["tea_busi.ComplexType_Salary"].AMOUNT,
		"/OverloadedAction/AMOUNT" : mScope["tea_busi.ComplexType_Salary"].AMOUNT,
		"/T€AMS/name.space.OverloadedAction/Team_Id" : oTeamData.Team_Id,
		"/T€AMS/name.space.OverloadedAction/@$ui5.overload"
			: sinon.match.array.deepEquals([aOverloadedAction[1]]),
		"/name.space.OverloadedAction/@$ui5.overload" : sinon.match.array.deepEquals([]),
		// only "Action" and "Function" is expected as $kind, but others are not filtered out!
		"/name.space.BrokenOverloads"
			: sinon.match.array.deepEquals(mScope["name.space.BrokenOverloads"]),
		// annotations ----------------------------------------------------------------------------
		"/@DefaultContainer"
			: mScope.$Annotations["tea_busi.DefaultContainer"]["@DefaultContainer"],
		"/tea_busi.DefaultContainer@DefaultContainer"
			: mScope.$Annotations["tea_busi.DefaultContainer"]["@DefaultContainer"],
		"/tea_busi.DefaultContainer/@DefaultContainer" // w/o $Type, slash makes no difference!
			: mScope.$Annotations["tea_busi.DefaultContainer"]["@DefaultContainer"],
		"/$EntityContainer@DefaultContainer" // Note: we could change this
			: mScope.$Annotations["tea_busi.DefaultContainer"]["@DefaultContainer"],
		"/$EntityContainer/@DefaultContainer" // w/o $Type, slash makes no difference!
			: mScope.$Annotations["tea_busi.DefaultContainer"]["@DefaultContainer"],
		"/T€AMS/$Type/@UI.LineItem" : oTeamLineItem,
		"/T€AMS/@UI.LineItem" : oTeamLineItem,
		"/T€AMS/@UI.LineItem/0/Label" : oTeamLineItem[0].Label,
		"/T€AMS/@UI.LineItem/0/@UI.Importance" : oTeamLineItem[0]["@UI.Importance"],
		"/T€AMS@T€AMS"
			: mScope.$Annotations["tea_busi.DefaultContainer/T€AMS"]["@T€AMS"],
		"/T€AMS/@Common.Text"
			: mScope.$Annotations["tea_busi.TEAM"]["@Common.Text"],
		"/T€AMS/@Common.Text@UI.TextArrangement"
			: mScope.$Annotations["tea_busi.TEAM"]["@Common.Text@UI.TextArrangement"],
		"/T€AMS/Team_Id@Common.Text"
			: mScope.$Annotations["tea_busi.TEAM/Team_Id"]["@Common.Text"],
		"/T€AMS/Team_Id@Common.Text@UI.TextArrangement"
			: mScope.$Annotations["tea_busi.TEAM/Team_Id"]["@Common.Text@UI.TextArrangement"],
		"/tea_busi./@Schema" : mScope["tea_busi."]["@Schema"],
		// inline annotations
		"/ChangeManagerOfTeam/$Action/0/$ReturnType/@Common.Label" : "Hail to the Chief",
		"/T€AMS/TEAM_2_EMPLOYEES/$OnDelete@Common.Label" : "None of my business",
		"/T€AMS/TEAM_2_EMPLOYEES/$ReferentialConstraint/foo@Common.Label" : "Just a Gigolo",
		"/T€AMS/@UI.LineItem/0/Label@Common.Label" : "Team ID's Label",
		"/T€AMS/@UI.Badge@Common.Label" : "Best Badge Ever!", // annotation of annotation
		"/T€AMS/@UI.Badge/@Common.Label" : "Label inside", // annotation of record
		// "@" to access to all annotations, e.g. for iteration
		"/T€AMS@" : mScope.$Annotations["tea_busi.DefaultContainer/T€AMS"],
		"/T€AMS/@" : mScope.$Annotations["tea_busi.TEAM"],
		"/T€AMS/Team_Id@" : mScope.$Annotations["tea_busi.TEAM/Team_Id"],
		// "14.5.12 Expression edm:Path"
		// Note: see integration test "{field>Value/$Path@com.sap.vocabularies.Common.v1.Label}"
		"/T€AMS/@UI.LineItem/0/Value/$Path@Common.Text"
			: mScope.$Annotations["tea_busi.TEAM/Team_Id"]["@Common.Text"],
		"/T€AMS/@UI.LineItem/0/Value/$Path/@Common.Label"
			: mScope.$Annotations["name.space.Id"]["@Common.Label"],
		"/EMPLOYEES/@UI.LineItem/0/Value/$Path@Common.Text"
			: mScope.$Annotations["tea_busi.TEAM/Team_Id"]["@Common.Text"],
		// "14.5.2 Expression edm:AnnotationPath"
		"/EMPLOYEES/@UI.Facets/0/Target/$AnnotationPath/"
			: mScope.$Annotations["tea_busi.Worker"]["@UI.LineItem"],
		"/EMPLOYEES/@UI.Facets/1/Target/$AnnotationPath/"
			: mScope.$Annotations["tea_busi.Worker/EMPLOYEE_2_TEAM"]["@Common.Label"],
		"/EMPLOYEES/@UI.Facets/2/Target/$AnnotationPath/"
			: mScope.$Annotations["tea_busi.TEAM"]["@UI.LineItem"],
		"/EMPLOYEES/@UI.Facets/3/Target/$AnnotationPath/"
			: mScope.$Annotations["tea_busi.TEAM"]["@UI.LineItem"],
		// @sapui.name ----------------------------------------------------------------------------
		"/@sapui.name" : "tea_busi.DefaultContainer",
		"/tea_busi.DefaultContainer@sapui.name" : "tea_busi.DefaultContainer",
		"/tea_busi.DefaultContainer/@sapui.name" : "tea_busi.DefaultContainer", // no $Type here!
		"/$EntityContainer/@sapui.name" : "tea_busi.DefaultContainer",
		"/T€AMS@sapui.name" : "T€AMS",
		"/T€AMS/@sapui.name" : "tea_busi.TEAM",
		"/T€AMS/Team_Id@sapui.name" : "Team_Id",
		"/T€AMS/TEAM_2_EMPLOYEES@sapui.name" : "TEAM_2_EMPLOYEES",
		"/T€AMS/$NavigationPropertyBinding/TEAM_2_EMPLOYEES/@sapui.name" : "tea_busi.Worker",
		"/T€AMS/$NavigationPropertyBinding/TEAM_2_EMPLOYEES/AGE@sapui.name" : "AGE",
		"/T€AMS@T€AMS@sapui.name" : "@T€AMS",
		"/T€AMS@/@T€AMS@sapui.name" : "@T€AMS",
		"/T€AMS@T€AMS/@sapui.name" : "@T€AMS", // no $Type inside @T€AMS, / makes no difference!
		"/T€AMS@/@T€AMS/@sapui.name" : "@T€AMS", // dito
		"/T€AMS/@UI.LineItem/0/@UI.Importance/@sapui.name" : "@UI.Importance", // in "JSON" mode
		"/T€AMS/Team_Id@/@Common.Label@sapui.name" : "@Common.Label" // avoid indirection here!
	}, function (sPath, vResult) {
		QUnit.test("fetchObject: " + sPath, function (assert) {
			var oSyncPromise;

			this.oMetaModelMock.expects("fetchEntityContainer")
				.returns(SyncPromise.resolve(mScope));

			// code under test
			oSyncPromise = this.oMetaModel.fetchObject(sPath);

			assert.strictEqual(oSyncPromise.isFulfilled(), true);
			if (vResult && typeof vResult === "object" && "test" in vResult) {
				// Sinon.JS matcher
				assert.ok(vResult.test(oSyncPromise.getResult()), vResult);
			} else {
				assert.strictEqual(oSyncPromise.getResult(), vResult);
			}
			// self-guard to avoid that a complex right-hand side evaluates to undefined
			assert.notStrictEqual(vResult, undefined, "use this test for defined results only!");
		});
	});
	//TODO annotations at enum member ".../<10.2.1 Member Name>@..." (Note: "<10.2.2 Member Value>"
	// might be a string! Avoid indirection!)
	//TODO special cases where inline and external targeting annotations need to be merged!
	//TODO support also external targeting from a different schema!
	//TODO MySchema.MyFunction/MyParameter --> requires search in array?!
	//TODO $count?
	//TODO "For annotations targeting a property of an entity type or complex type, the path
	// expression is evaluated starting at the outermost entity type or complex type named in the
	// Target of the enclosing edm:Annotations element, i.e. an empty path resolves to the
	// outermost type, and the first segment of a non-empty path MUST be a property or navigation
	// property of the outermost type, a type cast, or a term cast." --> consequences for us?

	//*********************************************************************************************
	[
		// "JSON" drill-down ----------------------------------------------------------------------
		"/$missing",
		"/tea_busi.DefaultContainer/$missing",
		"/tea_busi.DefaultContainer/missing", // "17.2 SimpleIdentifier" treated like any property
		"/tea_busi.FuGetEmployeeMaxAge/0/tea_busi.FuGetEmployeeMaxAge", // "0" switches to JSON
		"/tea_busi.TEAM/$Key/this.is.missing",
		"/tea_busi.Worker/missing", // entity container (see above) treated like any schema child
		// scope lookup ("17.3 QualifiedName") ----------------------------------------------------
		"/$EntityContainer/$missing",
		"/$EntityContainer/missing",
		// implicit $Type insertion ---------------------------------------------------------------
		"/T€AMS/$Key", // avoid $Type insertion for following $ segments
		"/T€AMS/missing",
		"/T€AMS/$missing",
		// annotations ----------------------------------------------------------------------------
		"/tea_busi.Worker@missing",
		"/tea_busi.Worker/@missing",
		// "@" to access to all annotations, e.g. for iteration
		"/tea_busi.Worker/@/@missing",
		// operations -----------------------------------------------------------------------------
		"/VoidAction/"
	].forEach(function (sPath) {
		QUnit.test("fetchObject: " + sPath + " --> undefined", function (assert) {
			var oSyncPromise;

			this.oMetaModelMock.expects("fetchEntityContainer")
				.returns(SyncPromise.resolve(mScope));

			// code under test
			oSyncPromise = this.oMetaModel.fetchObject(sPath);

			assert.strictEqual(oSyncPromise.isFulfilled(), true);
			assert.strictEqual(oSyncPromise.getResult(), undefined);
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchObject: Invalid relative path w/o context", function (assert) {
		var sMetaPath = "some/relative/path",
			oSyncPromise;

		this.oLogMock.expects("error").withExactArgs("Invalid relative path w/o context", sMetaPath,
			sODataMetaModel);

		// code under test
		oSyncPromise = this.oMetaModel.fetchObject(sMetaPath, null);

		assert.strictEqual(oSyncPromise.isFulfilled(), true);
		assert.strictEqual(oSyncPromise.getResult(), null);
	});

	//*********************************************************************************************
	["/empty.Container/@", "/T€AMS/Name@"].forEach(function (sPath) {
		QUnit.test("fetchObject returns {} (anonymous empty object): " + sPath, function (assert) {
			var oSyncPromise;

			this.oMetaModelMock.expects("fetchEntityContainer")
				.returns(SyncPromise.resolve(mScope));

			// code under test
			oSyncPromise = this.oMetaModel.fetchObject(sPath);

			assert.strictEqual(oSyncPromise.isFulfilled(), true);
			assert.deepEqual(oSyncPromise.getResult(), {}); // strictEqual would not work!
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchObject without $Annotations", function (assert) {
		var oSyncPromise;

		this.oMetaModelMock.expects("fetchEntityContainer")
			.returns(SyncPromise.resolve(mMostlyEmptyScope));

		// code under test
		oSyncPromise = this.oMetaModel.fetchObject("/@DefaultContainer");

		assert.strictEqual(oSyncPromise.isFulfilled(), true);
		assert.deepEqual(oSyncPromise.getResult(), undefined); // strictEqual would not work!
	});
	//TODO if no annotations exist for an external target, avoid {} internally unless "@" is used?

	//*********************************************************************************************
	[false, true].forEach(function (bWarn) {
		forEach({
			"/$$Loop/" : "Invalid recursion at /$$Loop",
			// Invalid segment (warning) ----------------------------------------------------------
			"//$Foo" : "Invalid empty segment",
			"/tea_busi./$Annotations" : "Invalid segment: $Annotations", // entrance forbidden!
			// Unknown ... ------------------------------------------------------------------------
			"/not.Found" : "Unknown qualified name not.Found",
			"/Me/not.Found" : "Unknown qualified name not.Found", // no "at /.../undefined"!
			"/not.Found@missing" : "Unknown qualified name not.Found",
			"/." : "Unknown child . of tea_busi.DefaultContainer",
			"/Foo" : "Unknown child Foo of tea_busi.DefaultContainer",
			"/$EntityContainer/$kind/" : "Unknown child EntityContainer"
				+ " of tea_busi.DefaultContainer at /$EntityContainer/$kind",
			// implicit $Action, $Function, $Type insertion
			"/name.space.BadContainer/DanglingActionImport/" : "Unknown qualified name not.Found"
				+ " at /name.space.BadContainer/DanglingActionImport/$Action",
			"/name.space.BadContainer/DanglingFunctionImport/" :
				"Unknown qualified name not.Found"
				+ " at /name.space.BadContainer/DanglingFunctionImport/$Function",
			"/name.space.Broken/" :
				"Unknown qualified name not.Found at /name.space.Broken/$Type",
			"/name.space.BrokenFunction/" : "Unknown qualified name not.Found"
				+ " at /name.space.BrokenFunction/0/$ReturnType/$Type",
			//TODO align with "/GetEmployeeMaxAge/" : "Edm.Int16"
			"/GetEmployeeMaxAge/@sapui.name" : "Unknown qualified name Edm.Int16"
				+ " at /tea_busi.FuGetEmployeeMaxAge/0/$ReturnType/$Type",
			"/GetEmployeeMaxAge/value/@sapui.name" : "Unknown qualified name Edm.Int16"
				+ " at /tea_busi.FuGetEmployeeMaxAge/0/$ReturnType/$Type",
			// implicit scope lookup
			"/name.space.Broken/$Type/" :
				"Unknown qualified name not.Found at /name.space.Broken/$Type",
			"/tea_busi.DefaultContainer/$kind/@sapui.name" : "Unknown child EntityContainer"
				+ " of tea_busi.DefaultContainer at /tea_busi.DefaultContainer/$kind",
			// Unsupported path before @sapui.name ------------------------------------------------
			"/$EntityContainer@sapui.name" : "Unsupported path before @sapui.name",
			"/tea_busi.FuGetEmployeeMaxAge/0@sapui.name" : "Unsupported path before @sapui.name",
			"/tea_busi.TEAM/$Key/not.Found/@sapui.name" : "Unsupported path before @sapui.name",
			"/GetEmployeeMaxAge/value@sapui.name" : "Unsupported path before @sapui.name",
			// Unsupported path after @sapui.name -------------------------------------------------
			"/@sapui.name/foo" : "Unsupported path after @sapui.name",
			"/$EntityContainer/T€AMS/@sapui.name/foo" : "Unsupported path after @sapui.name",
			// Unsupported path after @@... -------------------------------------------------------
			"/EMPLOYEES/@UI.Facets/1/Target/$AnnotationPath@@this.is.ignored/foo"
				: "Unsupported path after @@this.is.ignored",
			"/EMPLOYEES/@UI.Facets/1/Target/$AnnotationPath/@@this.is.ignored@foo"
				: "Unsupported path after @@this.is.ignored",
			"/EMPLOYEES/@UI.Facets/1/Target/$AnnotationPath@@this.is.ignored@sapui.name"
				: "Unsupported path after @@this.is.ignored",
			// ...is not a function but... --------------------------------------------------------
			"/@@sap.ui.model.odata.v4.AnnotationHelper.invalid"
				: "sap.ui.model.odata.v4.AnnotationHelper.invalid is not a function but: undefined",
			"/@@sap.ui.model.odata.v4.AnnotationHelper"
				: "sap.ui.model.odata.v4.AnnotationHelper is not a function but: "
					+ sap.ui.model.odata.v4.AnnotationHelper,
			// Unsupported overloads --------------------------------------------------------------
			"/name.space.EmptyOverloads/" : "Unsupported overloads",
			"/name.space.OverloadedAction/" : "Unsupported overloads",
			"/name.space.OverloadedFunction/" : "Unsupported overloads"
		}, function (sPath, sWarning) {
			QUnit.test("fetchObject fails: " + sPath + ", warn = " + bWarn, function (assert) {
				var oSyncPromise;

				this.oMetaModelMock.expects("fetchEntityContainer")
					.returns(SyncPromise.resolve(mScope));
				this.oLogMock.expects("isLoggable")
					.withExactArgs(Log.Level.WARNING, sODataMetaModel).returns(bWarn);
				this.oLogMock.expects("warning").exactly(bWarn ? 1 : 0)
					.withExactArgs(sWarning, sPath, sODataMetaModel);

				// code under test
				oSyncPromise = this.oMetaModel.fetchObject(sPath);

				assert.strictEqual(oSyncPromise.isFulfilled(), true);
				assert.deepEqual(oSyncPromise.getResult(), undefined);
			});
		});
	});

	//*********************************************************************************************
	[false, true].forEach(function (bDebug) {
		forEach({
			// Invalid segment (debug) ------------------------------------------------------------
			"/$Foo/@bar" : "Invalid segment: @bar",
			"/$Foo/$Bar" : "Invalid segment: $Bar",
			"/$Foo/$Bar/$Baz" : "Invalid segment: $Bar",
			"/$EntityContainer/T€AMS/Team_Id/$MaxLength/." : "Invalid segment: .",
			"/$EntityContainer/T€AMS/Team_Id/$Nullable/." : "Invalid segment: .",
			"/$EntityContainer/T€AMS/Team_Id/NotFound/Invalid" : "Invalid segment: Invalid"
		}, function (sPath, sMessage) {
			QUnit.test("fetchObject fails: " + sPath + ", debug = " + bDebug, function (assert) {
				var oSyncPromise;

				this.oMetaModelMock.expects("fetchEntityContainer")
					.returns(SyncPromise.resolve(mScope));
				this.oLogMock.expects("isLoggable")
					.withExactArgs(Log.Level.DEBUG, sODataMetaModel).returns(bDebug);
				this.oLogMock.expects("debug").exactly(bDebug ? 1 : 0)
					.withExactArgs(sMessage, sPath, sODataMetaModel);

				// code under test
				oSyncPromise = this.oMetaModel.fetchObject(sPath);

				assert.strictEqual(oSyncPromise.isFulfilled(), true);
				assert.deepEqual(oSyncPromise.getResult(), undefined);
			});
		});
	});

	//*********************************************************************************************
	[
		"/EMPLOYEES/@UI.Facets/1/Target/$AnnotationPath",
		"/EMPLOYEES/@UI.Facets/1/Target/$AnnotationPath/"
	].forEach(function (sPath) {
		QUnit.test("fetchObject: " + sPath + "@@...isMultiple", function (assert) {
			var oContext,
				oInput,
				fnIsMultiple = this.mock(AnnotationHelper).expects("isMultiple"),
				oResult = {},
				oSyncPromise;

			this.oMetaModelMock.expects("fetchEntityContainer").atLeast(1) // see oInput
				.returns(SyncPromise.resolve(mScope));
			oInput = this.oMetaModel.getObject(sPath);
			fnIsMultiple
				.withExactArgs(oInput, sinon.match({
					context : sinon.match.object,
					schemaChildName : "tea_busi.Worker"
				})).returns(oResult);

			// code under test
			oSyncPromise = this.oMetaModel.fetchObject(sPath
				+ "@@sap.ui.model.odata.v4.AnnotationHelper.isMultiple");

			assert.strictEqual(oSyncPromise.isFulfilled(), true);
			assert.strictEqual(oSyncPromise.getResult(), oResult);
			oContext = fnIsMultiple.args[0][1].context;
			assert.ok(oContext instanceof BaseContext);
			assert.strictEqual(oContext.getModel(), this.oMetaModel);
			assert.strictEqual(oContext.getPath(), sPath);
			assert.strictEqual(oContext.getObject(), oInput);
		});
	});

	//*********************************************************************************************
	["@@computedAnnotation", "@@.computedAnnotation"].forEach(function (sSuffix) {
		var sPath,
			sPathPrefix,
			mPathPrefix2SchemaChildName = {
				"/EMPLOYEES/@UI.Facets/1/Target/$AnnotationPath" : "tea_busi.Worker",
				"/T€AMS/@UI.LineItem/0/Value/$Path@Common.Label" : "tea_busi.TEAM",
				"/T€AMS/@UI.LineItem/0/Value/$Path/@Common.Label" : "name.space.Id"
			},
			sSchemaChildName;

		for (sPathPrefix in mPathPrefix2SchemaChildName) {
			sPath = sPathPrefix + sSuffix;
			sSchemaChildName = mPathPrefix2SchemaChildName[sPathPrefix];

			QUnit.test("fetchObject: " + sPath, function (assert) {
				var $$valueAsPromise = {/*false, true*/},
					fnComputedAnnotation,
					oContext,
					oInput,
					oResult = {},
					oScope = {
						computedAnnotation : function () {}
					},
					oSyncPromise;

				this.oMetaModelMock.expects("fetchEntityContainer").atLeast(1) // see oInput
					.returns(SyncPromise.resolve(mScope));
				oInput = this.oMetaModel.getObject(sPathPrefix);
				fnComputedAnnotation = this.mock(oScope).expects("computedAnnotation");
				fnComputedAnnotation
					.withExactArgs(oInput, sinon.match({
						$$valueAsPromise : sinon.match.same($$valueAsPromise),
						context : sinon.match.object,
						schemaChildName : sSchemaChildName
					})).returns(oResult);

				// code under test
				oSyncPromise = this.oMetaModel.fetchObject(sPath, null, {
					$$valueAsPromise : $$valueAsPromise,
					scope : oScope
				});

				assert.strictEqual(oSyncPromise.isFulfilled(), true);
				assert.strictEqual(oSyncPromise.getResult(), oResult);
				oContext = fnComputedAnnotation.args[0][1].context;
				assert.ok(oContext instanceof BaseContext);
				assert.strictEqual(oContext.getModel(), this.oMetaModel);
				assert.strictEqual(oContext.getPath(), sPathPrefix);
				assert.strictEqual(oContext.getObject(), oInput);
			});
		}
	});

	//*********************************************************************************************
	[false, true].forEach(function (bWarn) {
		QUnit.test("fetchObject: " + "...@@... throws", function (assert) {
			var oError = new Error("This call failed intentionally"),
				sPath = "/@@sap.ui.model.odata.v4.AnnotationHelper.isMultiple",
				oSyncPromise;

			this.oMetaModelMock.expects("fetchEntityContainer")
				.returns(SyncPromise.resolve(mScope));
			this.mock(AnnotationHelper).expects("isMultiple")
				.throws(oError);
			this.oLogMock.expects("isLoggable")
				.withExactArgs(Log.Level.WARNING, sODataMetaModel).returns(bWarn);
			this.oLogMock.expects("warning").exactly(bWarn ? 1 : 0).withExactArgs(
				"Error calling sap.ui.model.odata.v4.AnnotationHelper.isMultiple: " + oError,
				sPath, sODataMetaModel);

			// code under test
			oSyncPromise = this.oMetaModel.fetchObject(sPath);

			assert.strictEqual(oSyncPromise.isFulfilled(), true);
			assert.strictEqual(oSyncPromise.getResult(), undefined);
		});
	});

	//*********************************************************************************************
	[false, true].forEach(function (bDebug) {
		QUnit.test("fetchObject: cross-service reference, bDebug = " + bDebug, function (assert) {
			var mClonedProductScope = clone(mProductScope),
				aPromises = [],
				oRequestorMock = this.mock(this.oMetaModel.oRequestor),
				that = this;

			/*
			 * Expect the given debug message with the given path.
			 */
			function expectDebug(sMessage, sPath) {
				that.expectDebug(bDebug, sMessage, sPath);
			}

			/*
			 * Code under test: ODataMetaModel#fetchObject with the given path should yield the
			 * given expected result.
			 */
			function codeUnderTest(sPath, vExpectedResult) {
				aPromises.push(that.oMetaModel.fetchObject(sPath).then(function (vResult) {
					assert.strictEqual(vResult, vExpectedResult);
				}));
			}

			this.expectFetchEntityContainer(mXServiceScope);
			oRequestorMock.expects("read")
				.withExactArgs("/a/default/iwbep/tea_busi_product/0001/$metadata")
				.returns(Promise.resolve(mClonedProductScope));
			oRequestorMock.expects("read")
				.withExactArgs("/a/default/iwbep/tea_busi_supplier/0001/$metadata")
				.returns(Promise.resolve(mSupplierScope));
			oRequestorMock.expects("read")
				.withExactArgs("/empty/$metadata")
				.returns(Promise.resolve(mMostlyEmptyScope));

			expectDebug("Namespace tea_busi_product.v0001. found in $Include"
				+ " of /a/default/iwbep/tea_busi_product/0001/$metadata"
				+ " at /tea_busi.v0001.EQUIPMENT/EQUIPMENT_2_PRODUCT/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/Name");
			expectDebug("Reading /a/default/iwbep/tea_busi_product/0001/$metadata"
				+ " at /tea_busi.v0001.EQUIPMENT/EQUIPMENT_2_PRODUCT/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/Name");
			expectDebug("Waiting for tea_busi_product.v0001."
				+ " at /tea_busi.v0001.EQUIPMENT/EQUIPMENT_2_PRODUCT/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/Name");
			codeUnderTest("/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/Name",
				mClonedProductScope["tea_busi_product.v0001.Product"].Name);

			expectDebug("Waiting for tea_busi_product.v0001."
				+ " at /tea_busi.v0001.EQUIPMENT/EQUIPMENT_2_PRODUCT/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/PRODUCT_2_CATEGORY/CategoryName");
			codeUnderTest("/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/PRODUCT_2_CATEGORY/CategoryName",
				mClonedProductScope["tea_busi_product.v0001.Category"].CategoryName);

			expectDebug("Waiting for tea_busi_product.v0001.",
				"/tea_busi_product.v0001.Category/CategoryName");
			codeUnderTest("/tea_busi_product.v0001.Category/CategoryName",
				mClonedProductScope["tea_busi_product.v0001.Category"].CategoryName);

			expectDebug("Waiting for tea_busi_product.v0001.",
				"/tea_busi_product.v0001.Category/CategoryName@Common.Label");
			codeUnderTest("/tea_busi_product.v0001.Category/CategoryName@Common.Label",
				"CategoryName from tea_busi_product.v0001.");

			expectDebug("Waiting for tea_busi_product.v0001."
				+ " at /tea_busi.v0001.EQUIPMENT/EQUIPMENT_2_PRODUCT/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/PRODUCT_2_SUPPLIER/Supplier_Name");
			codeUnderTest("/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/PRODUCT_2_SUPPLIER/Supplier_Name",
				mSupplierScope["tea_busi_supplier.v0001.Supplier"].Supplier_Name);

			expectDebug("Namespace empty. found in $Include of /empty/$metadata",
				"/empty.DefaultContainer");
			expectDebug("Reading /empty/$metadata", "/empty.DefaultContainer");
			expectDebug("Waiting for empty.",
				"/empty.DefaultContainer");
			codeUnderTest("/empty.DefaultContainer", mMostlyEmptyScope["empty.DefaultContainer"]);

			// Note: these are logged asynchronously!
			expectDebug("Including tea_busi_product.v0001."
				+ " from /a/default/iwbep/tea_busi_product/0001/$metadata"
				+ " at /tea_busi.v0001.EQUIPMENT/EQUIPMENT_2_PRODUCT/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/Name");
			expectDebug("Including empty. from /empty/$metadata",
				"/empty.DefaultContainer");
			expectDebug("Namespace tea_busi_supplier.v0001. found in $Include"
				+ " of /a/default/iwbep/tea_busi_supplier/0001/$metadata"
				+ " at /tea_busi_product.v0001.Product/PRODUCT_2_SUPPLIER/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/PRODUCT_2_SUPPLIER/Supplier_Name");
			expectDebug("Reading /a/default/iwbep/tea_busi_supplier/0001/$metadata"
				+ " at /tea_busi_product.v0001.Product/PRODUCT_2_SUPPLIER/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/PRODUCT_2_SUPPLIER/Supplier_Name");
			expectDebug("Waiting for tea_busi_supplier.v0001."
				+ " at /tea_busi_product.v0001.Product/PRODUCT_2_SUPPLIER/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/PRODUCT_2_SUPPLIER/Supplier_Name");
			expectDebug("Including tea_busi_supplier.v0001."
				+ " from /a/default/iwbep/tea_busi_supplier/0001/$metadata"
				+ " at /tea_busi_product.v0001.Product/PRODUCT_2_SUPPLIER/$Type",
				"/EQUIPM€NTS/EQUIPMENT_2_PRODUCT/PRODUCT_2_SUPPLIER/Supplier_Name");

			return Promise.all(aPromises);
		});
	});
	//TODO Decision: It is an error if a namespace is referenced multiple times with different URIs.
	//     This should be checked even when load-on-demand is used.
	//     (It should not even be included multiple times with the same URI!)
	//TODO Check that no namespace is included which is already present!
	//TODO API to load "transitive closure"
	//TODO support for sync. XML Templating

	//*********************************************************************************************
	[false, true].forEach(function (bWarn) {
		var sTitle = "fetchObject: missing cross-service reference, bWarn = " + bWarn;

		QUnit.test(sTitle, function (assert) {
			var sPath = "/not.found",
				oSyncPromise;

			this.expectFetchEntityContainer(mMostlyEmptyScope);
			this.oLogMock.expects("isLoggable")
				.withExactArgs(Log.Level.WARNING, sODataMetaModel).returns(bWarn);
			this.oLogMock.expects("warning").exactly(bWarn ? 1 : 0)
				.withExactArgs("Unknown qualified name not.found", sPath, sODataMetaModel);

			// code under test
			oSyncPromise = this.oMetaModel.fetchObject(sPath);

			assert.strictEqual(oSyncPromise.isFulfilled(), true);
			assert.deepEqual(oSyncPromise.getResult(), undefined);
		});
	});

	//*********************************************************************************************
	[false, true].forEach(function (bWarn) {
		var sTitle = "fetchObject: referenced metadata does not contain included schema, bWarn = "
			+ bWarn;

		QUnit.test(sTitle, function (assert) {
			var sSchemaName = "I.still.haven't.found.what.I'm.looking.for.",
				sQualifiedName = sSchemaName + "Child",
				sPath = "/" + sQualifiedName;

			this.expectFetchEntityContainer(mXServiceScope);
			this.mock(this.oMetaModel.oRequestor).expects("read")
				.withExactArgs("/empty/$metadata")
				.returns(Promise.resolve(mMostlyEmptyScope));
			this.allowWarnings(assert, bWarn);
			this.oLogMock.expects("warning").exactly(bWarn ? 1 : 0)
				.withExactArgs("/empty/$metadata does not contain " + sSchemaName, sPath,
					sODataMetaModel);
			this.oLogMock.expects("warning").exactly(bWarn ? 1 : 0)
				.withExactArgs("Unknown qualified name " + sQualifiedName, sPath, sODataMetaModel);

			// code under test
			return this.oMetaModel.fetchObject(sPath).then(function (vResult) {
				assert.deepEqual(vResult, undefined);
			});
		});
	});

	//*********************************************************************************************
	[false, true].forEach(function (bWarn) {
		var sTitle = "fetchObject: cross-service reference, respect $Include; bWarn = " + bWarn;

		QUnit.test(sTitle, function (assert) {
			var mScope0 = {
					"$Version" : "4.0",
					"$Reference" : {
						"../../../../default/iwbep/tea_busi_product/0001/$metadata" : {
							"$Include" : [
								"not.found.",
								"tea_busi_product.v0001.",
								"tea_busi_supplier.v0001."
							]
						}
					}
				},
				mReferencedScope = {
					"$Version" : "4.0",
					"must.not.be.included." : {
						"$kind" : "Schema"
					},
					"tea_busi_product.v0001." : {
						"$kind" : "Schema"
					},
					"tea_busi_supplier.v0001." : {
						"$kind" : "Schema"
					}
				},
				oRequestorMock = this.mock(this.oMetaModel.oRequestor),
				that = this;

			this.expectFetchEntityContainer(mScope0);
			oRequestorMock.expects("read")
				.withExactArgs("/a/default/iwbep/tea_busi_product/0001/$metadata")
				.returns(Promise.resolve(mReferencedScope));
			this.allowWarnings(assert, bWarn);

			// code under test
			return this.oMetaModel.fetchObject("/tea_busi_product.v0001.").then(function (vResult) {
				var oSyncPromise;

				assert.strictEqual(vResult, mReferencedScope["tea_busi_product.v0001."]);

				assert.ok(that.oMetaModel.mSchema2MetadataUrl["tea_busi_product.v0001."]
					["/a/default/iwbep/tea_busi_product/0001/$metadata"],
					"document marked as read");

				that.oLogMock.expects("warning").exactly(bWarn ? 1 : 0)
					.withExactArgs("Unknown qualified name must.not.be.included.",
						"/must.not.be.included.", sODataMetaModel);
				assert.strictEqual(that.oMetaModel.getObject("/must.not.be.included."),
					undefined,
					"must not include schemata which are not mentioned in edmx:Include");

				assert.strictEqual(that.oMetaModel.getObject("/tea_busi_supplier.v0001."),
					mReferencedScope["tea_busi_supplier.v0001."]);

				// now check that "not.found." does not trigger another read(),
				// does finish synchronously and logs a warning
				that.oLogMock.expects("warning").exactly(bWarn ? 1 : 0)
					.withExactArgs("/a/default/iwbep/tea_busi_product/0001/$metadata"
						+ " does not contain not.found.",
						"/not.found.", sODataMetaModel);
				that.oLogMock.expects("warning").exactly(bWarn ? 1 : 0)
					.withExactArgs("Unknown qualified name not.found.",
						"/not.found.", sODataMetaModel);

				// code under test
				oSyncPromise = that.oMetaModel.fetchObject("/not.found.");

				assert.strictEqual(oSyncPromise.isFulfilled(), true);
				assert.strictEqual(oSyncPromise.getResult(), undefined);
			});
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchObject: cross-service reference - validation failure", function (assert) {
		var oError = new Error(),
			mReferencedScope = {},
			sUrl = "/a/default/iwbep/tea_busi_product/0001/$metadata";

		this.expectFetchEntityContainer(mXServiceScope);
		this.mock(this.oMetaModel.oRequestor).expects("read").withExactArgs(sUrl)
			.returns(Promise.resolve(mReferencedScope));
		this.oMetaModelMock.expects("validate")
			.withExactArgs(sUrl, mReferencedScope)
			.throws(oError);

		return this.oMetaModel.fetchObject("/tea_busi_product.v0001.Product").then(function () {
				assert.ok(false);
			}, function (oError0) {
				assert.strictEqual(oError0, oError);
			});
	});

	//*********************************************************************************************
	QUnit.test("fetchObject: cross-service reference - document loaded from different URI",
			function (assert) {
		var sMessage = "A schema cannot span more than one document: schema is referenced by"
				+ " following URLs: /a/default/iwbep/tea_busi_product/0001/$metadata,"
				+ " /second/reference",
			sSchema = "tea_busi_product.v0001.";

		this.expectFetchEntityContainer(mXServiceScope);
		this.mock(this.oModel).expects("reportError")
			.withExactArgs(sMessage, sODataMetaModel, sinon.match({
				message : sSchema + ": " + sMessage,
				name : "Error"
			}));
		// simulate 2 references for a schema
		this.oMetaModel.mSchema2MetadataUrl["tea_busi_product.v0001."]["/second/reference"] = false;

		// code under test
		return this.oMetaModel.fetchObject("/tea_busi_product.v0001.Product").then(function () {
				assert.ok(false);
			}, function (oError0) {
				assert.strictEqual(oError0.message, sSchema + ": " + sMessage);
			});
	});

	//*********************************************************************************************
	QUnit.test("fetchObject: cross-service reference - duplicate include", function (assert) {
		var oRequestorMock = this.mock(this.oMetaModel.oRequestor),
			// root service includes both A and B, A also includes B
			mScope0 = {
				"$Version" : "4.0",
				"$Reference" : {
					"/A/$metadata" : {
						"$Include" : [
							"A."
						]
					},
					"/B/$metadata" : {
						"$Include" : [
							"B."
						]
					}
				}
			},
			mScopeA = {
				"$Version" : "4.0",
				"$Reference" : {
					"/B/$metadata" : {
						"$Include" : [
							"B.",
							"B.B." // includes additional namespace from already read document
						]
					}
				},
				"A." : {
					"$kind" : "Schema"
				}
			},
			mScopeB = {
				"$Version" : "4.0",
				"B." : {
					"$kind" : "Schema"
				},
				"B.B." : {
					"$kind" : "Schema"
				}
			},
			that = this;

		this.expectFetchEntityContainer(mScope0);
		oRequestorMock.expects("read").withExactArgs("/A/$metadata")
			.returns(Promise.resolve(mScopeA));
		oRequestorMock.expects("read").withExactArgs("/B/$metadata")
			.returns(Promise.resolve(mScopeB));

		return this.oMetaModel.fetchObject("/B.")
			.then(function (vResult) {
				assert.strictEqual(vResult, mScopeB["B."]);

				// code under test - we must not overwrite our "$ui5.read" promise!
				return that.oMetaModel.fetchObject("/A.")
					.then(function (vResult) {
						assert.strictEqual(vResult, mScopeA["A."]);

						// Note: must not trigger read() again!
						return that.oMetaModel.fetchObject("/B.B.")
							.then(function (vResult) {
								assert.strictEqual(vResult, mScopeB["B.B."]);
							});
					});
			});
	});
	//TODO Implement consistency checks that the same namespace is always included from the same
	//     reference URI, no matter which referencing document.

	//*********************************************************************************************
	[undefined, false, true].forEach(function (bSupportReferences) {
		var sTitle = "fetchObject: cross-service reference - supportReferences: "
				+ bSupportReferences;

		QUnit.test(sTitle, function (assert) {
			var mClonedProductScope = clone(mProductScope),
				oModel = new ODataModel({ // code under test
					serviceUrl : "/a/b/c/d/e/",
					supportReferences : bSupportReferences,
					synchronizationMode : "None"
				}),
				sPath = "/tea_busi_product.v0001.Product",
				sUrl = "/a/default/iwbep/tea_busi_product/0001/$metadata";

			this.oMetaModel = oModel.getMetaModel();
			this.oMetaModelMock = this.mock(this.oMetaModel);
			bSupportReferences = bSupportReferences !== false; // default is true!
			assert.strictEqual(this.oMetaModel.bSupportReferences, bSupportReferences);

			this.expectFetchEntityContainer(mXServiceScope);
			this.mock(this.oMetaModel.oRequestor).expects("read")
				.exactly(bSupportReferences ? 1 : 0)
				.withExactArgs(sUrl)
				.returns(Promise.resolve(mClonedProductScope));
			this.allowWarnings(assert, true);
			this.oLogMock.expects("warning").exactly(bSupportReferences ? 0 : 1)
				.withExactArgs("Unknown qualified name " + sPath.slice(1), sPath, sODataMetaModel);

			// code under test
			return this.oMetaModel.fetchObject(sPath).then(function (vResult) {
				assert.strictEqual(vResult, bSupportReferences
					? mClonedProductScope["tea_busi_product.v0001.Product"]
					: undefined);
			});
		});
	});

	//*********************************************************************************************
	QUnit.test("getObject, requestObject", function (assert) {
		return checkGetAndRequest(this, assert, "fetchObject", ["sPath", {/*oContext*/}]);
	});

	//*********************************************************************************************
	[{
		$Type : "Edm.Boolean"
	},{
		$Type : "Edm.Byte"
	}, {
		$Type : "Edm.Date"
	}, {
		$Type : "Edm.DateTimeOffset"
	},{
		$Precision : 7,
		$Type : "Edm.DateTimeOffset",
		__constraints : {precision : 7}
	}, {
		$Type : "Edm.Decimal"
	}, {
		$Precision : 20,
		$Scale : 5,
		$Type : "Edm.Decimal",
		__constraints : {maximum : "100.00", maximumExclusive : true, minimum : "0.00",
			precision : 20, scale : 5}
	}, {
		$Precision : 20,
		$Scale : "variable",
		$Type : "Edm.Decimal",
		__constraints : {precision : 20, scale : Infinity}
	}, {
		$Type : "Edm.Double"
	}, {
		$Type : "Edm.Guid"
	}, {
		$Type : "Edm.Int16"
	}, {
		$Type : "Edm.Int32"
	}, {
		$Type : "Edm.Int64"
	}, {
		$Type : "Edm.SByte"
	}, {
		$Type : "Edm.Single"
	}, {
		$Type : "Edm.Stream"
	}, {
		$Type : "Edm.String"
	}, {
		$MaxLength : 255,
		$Type : "Edm.String",
		__constraints : {maxLength : 255}
	}, {
		$Type : "Edm.String",
		__constraints : {isDigitSequence : true}
	}, {
		$Type : "Edm.TimeOfDay"
	}, {
		$Precision : 3,
		$Type : "Edm.TimeOfDay",
		__constraints : {precision : 3}
	}].forEach(function (oProperty0) {
		// Note: take care not to modify oProperty0, clone it first!
		[false, true].forEach(function (bNullable) {
			// Note: JSON.parse(JSON.stringify(...)) cannot clone Infinity!
			var oProperty = jQuery.extend(true, {}, oProperty0),
				oConstraints = oProperty.__constraints;

			delete oProperty.__constraints;
			if (!bNullable) {
				oProperty.$Nullable = false;
				oConstraints = oConstraints || {};
				oConstraints.nullable = false;
			}

			QUnit.test("fetchUI5Type: " + JSON.stringify(oProperty), function (assert) {
				// Note: just spy on fetchModule() to make sure that the real types are used
				// which check correctness of constraints
				var fnFetchModuleSpy = this.spy(this.oMetaModel, "fetchModule"),
					sPath = "/EMPLOYEES/0/ENTRYDATE",
					oMetaContext = this.oMetaModel.getMetaContext(sPath),
					that = this;

				this.oMetaModelMock.expects("fetchObject").twice()
					.withExactArgs(undefined, oMetaContext)
					.returns(SyncPromise.resolve(oProperty));
				if (oProperty.$Type === "Edm.String") { // simulate annotation for strings
					this.oMetaModelMock.expects("fetchObject")
						.withExactArgs("@com.sap.vocabularies.Common.v1.IsDigitSequence",
							oMetaContext)
						.returns(
							SyncPromise.resolve(oConstraints && oConstraints.isDigitSequence));
				} else if (oProperty.$Type === "Edm.Decimal") { // simulate annotation for decimals
					this.oMetaModelMock.expects("fetchObject")
						.withExactArgs("@Org.OData.Validation.V1.Minimum/$Decimal", oMetaContext)
						.returns(
							SyncPromise.resolve(oConstraints && oConstraints.minimum));
					this.oMetaModelMock.expects("fetchObject")
						.withExactArgs(
							"@Org.OData.Validation.V1.Minimum@Org.OData.Validation.V1.Exclusive",
							oMetaContext)
						.returns(
							SyncPromise.resolve(oConstraints && oConstraints.minimumExlusive));
					this.oMetaModelMock.expects("fetchObject")
						.withExactArgs("@Org.OData.Validation.V1.Maximum/$Decimal", oMetaContext)
						.returns(
							SyncPromise.resolve(oConstraints && oConstraints.maximum));
					this.oMetaModelMock.expects("fetchObject")
						.withExactArgs(
							"@Org.OData.Validation.V1.Maximum@Org.OData.Validation.V1.Exclusive",
							oMetaContext)
						.returns(
							SyncPromise.resolve(oConstraints && oConstraints.maximumExclusive));
				}

				// code under test
				return this.oMetaModel.fetchUI5Type(sPath).then(function (oType) {
					var sExpectedTypeName = "sap.ui.model.odata.type."
						+ oProperty.$Type.slice(4)/*cut off "Edm."*/;

					assert.strictEqual(fnFetchModuleSpy.callCount, 1);
					assert.ok(fnFetchModuleSpy.calledOn(that.oMetaModel));
					assert.ok(fnFetchModuleSpy.calledWithExactly(sExpectedTypeName),
						fnFetchModuleSpy.printf("%C"));
					assert.strictEqual(oType.getName(), sExpectedTypeName);
					assert.deepEqual(oType.oConstraints, oConstraints);
					assert.strictEqual(that.oMetaModel.getUI5Type(sPath), oType, "cached");
				});
			});
		});
	});
	//TODO later: support for facet DefaultValue?

	//*********************************************************************************************
	QUnit.test("fetchUI5Type: $count", function (assert) {
		var sPath = "/T€AMS/$count",
			oType;

		// code under test
		oType = this.oMetaModel.fetchUI5Type(sPath).getResult();

		assert.strictEqual(oType.getName(), "sap.ui.model.odata.type.Int64");
		assert.strictEqual(this.oMetaModel.getUI5Type(sPath), oType, "cached");
	});

	//*********************************************************************************************
	QUnit.test("fetchUI5Type: collection", function (assert) {
		var sPath = "/EMPLOYEES/0/foo",
			that = this;

		this.oMetaModelMock.expects("fetchObject").thrice()
			.withExactArgs(undefined, this.oMetaModel.getMetaContext(sPath))
			.returns(SyncPromise.resolve({
				$isCollection : true,
				$Nullable : false, // must not be turned into a constraint for Raw!
				$Type : "Edm.String"
			}));
		this.oLogMock.expects("warning").withExactArgs(
			"Unsupported collection type, using sap.ui.model.odata.type.Raw",
			sPath, sODataMetaModel);

		return Promise.all([
			// code under test
			this.oMetaModel.fetchUI5Type(sPath).then(function (oType) {
				assert.strictEqual(oType.getName(), "sap.ui.model.odata.type.Raw");
				assert.strictEqual(that.oMetaModel.getUI5Type(sPath), oType, "cached");
			}),
			// code under test
			this.oMetaModel.fetchUI5Type(sPath).then(function (oType) {
				assert.strictEqual(oType.getName(), "sap.ui.model.odata.type.Raw");
			})
		]);
	});

	//*********************************************************************************************
	//TODO make Edm.Duration work with OData V4
	["acme.Type", "Edm.Duration", "Edm.GeographyPoint"].forEach(function (sQualifiedName) {
		QUnit.test("fetchUI5Type: unsupported type " + sQualifiedName, function (assert) {
			var sPath = "/EMPLOYEES/0/foo",
				that = this;

			this.oMetaModelMock.expects("fetchObject").twice()
				.withExactArgs(undefined, this.oMetaModel.getMetaContext(sPath))
				.returns(SyncPromise.resolve({
					$Nullable : false, // must not be turned into a constraint for Raw!
					$Type : sQualifiedName
				}));
			this.oLogMock.expects("warning").withExactArgs(
				"Unsupported type '" + sQualifiedName + "', using sap.ui.model.odata.type.Raw",
				sPath, sODataMetaModel);

			// code under test
			return this.oMetaModel.fetchUI5Type(sPath).then(function (oType) {
				assert.strictEqual(oType.getName(), "sap.ui.model.odata.type.Raw");
				assert.strictEqual(that.oMetaModel.getUI5Type(sPath), oType, "cached");
			});
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchUI5Type: invalid path", function (assert) {
		var sPath = "/EMPLOYEES/0/invalid",
			that = this;

		this.oMetaModelMock.expects("fetchObject").twice()
			.withExactArgs(undefined, this.oMetaModel.getMetaContext(sPath))
			.returns(SyncPromise.resolve(/*no property metadata for path*/));
		this.oLogMock.expects("warning").twice().withExactArgs(
			"No metadata for path '" + sPath + "', using sap.ui.model.odata.type.Raw",
			undefined, sODataMetaModel);

		// code under test
		return this.oMetaModel.fetchUI5Type(sPath).then(function (oType) {
			assert.strictEqual(oType.getName(), "sap.ui.model.odata.type.Raw");

			// code under test
			assert.strictEqual(that.oMetaModel.getUI5Type(sPath), oType, "Type is cached");
		});
	});

	//*********************************************************************************************
	QUnit.test("getUI5Type, requestUI5Type", function (assert) {
		return checkGetAndRequest(this, assert, "fetchUI5Type", ["sPath"], true);
	});

	//*********************************************************************************************
	[{ // simple entity from a set
		dataPath : "/TEAMS/0",
		canonicalUrl : "/TEAMS(~1)",
		requests : [{
			entityType : "tea_busi.TEAM",
			predicate : "(~1)"
		}]
	}, { // simple entity in transient context
		dataPath : "/TEAMS/-1",
		canonicalUrl : "/TEAMS(~1)",
		requests : [{
			entityType : "tea_busi.TEAM",
			// TODO a transient entity does not necessarily have all key properties, but this is
			//      required to create a dependent cache
			predicate : "(~1)"
		}]
	}, { // simple entity by key predicate
		dataPath : "/TEAMS('4%3D2')",
		canonicalUrl : "/TEAMS('4%3D2')",
		requests : []
	}, { // simple singleton
		dataPath : "/Me",
		canonicalUrl : "/Me",
		requests : []
	}, { // navigation to root entity
		dataPath : "/TEAMS/0/TEAM_2_EMPLOYEES/1",
		canonicalUrl : "/EMPLOYEES(~1)",
		requests : [{
			entityType : "tea_busi.Worker",
			predicate : "(~1)"
		}]
	}, { // navigation to root entity
		dataPath : "/TEAMS('42')/TEAM_2_EMPLOYEES/1",
		canonicalUrl : "/EMPLOYEES(~1)",
		requests : [{
			entityType : "tea_busi.Worker",
			predicate : "(~1)"
		}]
	}, { // navigation to root entity with key predicate
		dataPath : "/TEAMS('42')/TEAM_2_EMPLOYEES('23')",
		canonicalUrl : "/EMPLOYEES('23')",
		requests : []
	}, { // multiple navigation to root entity
		dataPath : "/TEAMS/0/TEAM_2_EMPLOYEES/1/EMPLOYEE_2_TEAM",
		canonicalUrl : "/T%E2%82%ACAMS(~1)",
		requests : [{
			entityType : "tea_busi.TEAM",
			predicate : "(~1)"
		}]
	}, { // navigation from entity set to single contained entity
		dataPath : "/TEAMS/0/TEAM_2_CONTAINED_S",
		canonicalUrl : "/TEAMS(~1)/TEAM_2_CONTAINED_S",
		requests : [{
			entityType : "tea_busi.TEAM",
			path : "/TEAMS/0",
			predicate : "(~1)"
		}]
	}, { // navigation from singleton to single contained entity
		dataPath : "/Me/EMPLOYEE_2_CONTAINED_S",
		canonicalUrl : "/Me/EMPLOYEE_2_CONTAINED_S",
		requests : []
	}, { // navigation to contained entity within a collection
		dataPath : "/TEAMS/0/TEAM_2_CONTAINED_C/1",
		canonicalUrl : "/TEAMS(~1)/TEAM_2_CONTAINED_C(~2)",
		requests : [{
			entityType : "tea_busi.TEAM",
			path : "/TEAMS/0",
			predicate : "(~1)"
		}, {
			entityType : "tea_busi.ContainedC",
			path : "/TEAMS/0/TEAM_2_CONTAINED_C/1",
			predicate : "(~2)"
		}]
	}, { // navigation to contained entity with a key predicate
		dataPath : "/TEAMS('42')/TEAM_2_CONTAINED_C('foo')",
		canonicalUrl : "/TEAMS('42')/TEAM_2_CONTAINED_C('foo')",
		requests : []
	}, { // navigation from contained entity to contained entity
		dataPath : "/TEAMS/0/TEAM_2_CONTAINED_S/S_2_C/1",
		canonicalUrl : "/TEAMS(~1)/TEAM_2_CONTAINED_S/S_2_C(~2)",
		requests : [{
			entityType : "tea_busi.TEAM",
			path : "/TEAMS/0",
			predicate : "(~1)"
		}, {
			entityType : "tea_busi.ContainedC",
			path : "/TEAMS/0/TEAM_2_CONTAINED_S/S_2_C/1",
			predicate : "(~2)"
		}]
	}, { // navigation from contained to root entity
		// must be appended nevertheless since we only have a type, but no set
		dataPath : "/TEAMS/0/TEAM_2_CONTAINED_C/5/C_2_EMPLOYEE",
		canonicalUrl : "/TEAMS(~1)/TEAM_2_CONTAINED_C(~2)/C_2_EMPLOYEE",
		requests : [{
			entityType : "tea_busi.TEAM",
			path : "/TEAMS/0",
			predicate : "(~1)"
		}, {
			entityType : "tea_busi.ContainedC",
			path : "/TEAMS/0/TEAM_2_CONTAINED_C/5",
			predicate : "(~2)"
		}]
	}, { // navigation from entity w/ key predicate to contained to root entity
		dataPath : "/TEAMS('42')/TEAM_2_CONTAINED_C/5/C_2_EMPLOYEE",
		canonicalUrl : "/TEAMS('42')/TEAM_2_CONTAINED_C(~1)/C_2_EMPLOYEE",
		requests : [{
			entityType : "tea_busi.ContainedC",
			path : "/TEAMS('42')/TEAM_2_CONTAINED_C/5",
			predicate : "(~1)"
		}]
	}, { // decode entity set initially, encode it finally
		dataPath : "/T%E2%82%ACAMS/0",
		canonicalUrl : "/T%E2%82%ACAMS(~1)",
		requests : [{
			entityType : "tea_busi.TEAM",
			predicate : "(~1)"
		}]
	}, { // decode navigation property, encode entity set when building sCandidate
		dataPath : "/EMPLOYEES('7')/EMPLOYEE_2_EQUIPM%E2%82%ACNTS(42)",
		canonicalUrl : "/EQUIPM%E2%82%ACNTS(42)",
		requests : []
	}].forEach(function (oFixture) {
		QUnit.test("fetchCanonicalPath: " + oFixture.dataPath, function (assert) {
			var oContext = Context.create(this.oModel, undefined, oFixture.dataPath),
				oContextMock = this.mock(oContext),
				oPromise;

			this.oMetaModelMock.expects("getMetaPath").withExactArgs(oFixture.dataPath)
				.returns("metapath");
			this.oMetaModelMock.expects("fetchObject").withExactArgs("metapath")
				.returns(SyncPromise.resolve());
			this.oMetaModelMock.expects("fetchEntityContainer")
				.returns(SyncPromise.resolve(mScope));
			oFixture.requests.forEach(function (oRequest) {
				var oEntityInstance = {"@$ui5._" : {"predicate" : oRequest.predicate}};

				oContextMock.expects("fetchValue")
					.withExactArgs(oRequest.path || oFixture.dataPath)
					.returns(SyncPromise.resolve(oEntityInstance));
			});

			// code under test
			oPromise = this.oMetaModel.fetchCanonicalPath(oContext);

			assert.ok(!oPromise.isRejected());
			return oPromise.then(function (sCanonicalUrl) {
				assert.strictEqual(sCanonicalUrl, oFixture.canonicalUrl);
			});
		});
	});

	//*********************************************************************************************
	[{ // simple singleton
		path : "/Me|ID",
		editUrl : "Me"
	}, { // simple entity by key predicate
		path : "/TEAMS('42')|Name",
		editUrl : "TEAMS('42')"
	}, { // simple entity from a set
		path : "/TEAMS/0|Name",
		fetchPredicates : {
			"/TEAMS/0" : "tea_busi.TEAM"
		},
		editUrl : "TEAMS(~0)"
	}, { // simple entity from a set, complex property
		path : "/EMPLOYEES/0|SAL%C3%83RY/CURRENCY",
		fetchPredicates : {
			"/EMPLOYEES/0" : "tea_busi.Worker"
		},
		editUrl : "EMPLOYEES(~0)"
	}, { // navigation to root entity
		path : "/TEAMS/0/TEAM_2_EMPLOYEES/1|ID",
		fetchPredicates : {
			"/TEAMS/0/TEAM_2_EMPLOYEES/1" : "tea_busi.Worker"
		},
		editUrl : "EMPLOYEES(~0)"
	}, { // navigation to root entity
		path : "/TEAMS('42')/TEAM_2_EMPLOYEES/1|ID",
		fetchPredicates : {
			"/TEAMS('42')/TEAM_2_EMPLOYEES/1" : "tea_busi.Worker"
		},
		editUrl : "EMPLOYEES(~0)"
	}, { // navigation to root entity with key predicate
		path : "/TEAMS('42')/TEAM_2_EMPLOYEES('23')|ID",
		editUrl : "EMPLOYEES('23')"
	}, { // multiple navigation to root entity
		path : "/TEAMS/0/TEAM_2_EMPLOYEES/1/EMPLOYEE_2_TEAM|Name",
		fetchPredicates : {
			"/TEAMS/0/TEAM_2_EMPLOYEES/1/EMPLOYEE_2_TEAM" : "tea_busi.TEAM"
		},
		editUrl : "T%E2%82%ACAMS(~0)"
	}, { // navigation from entity set to single contained entity
		path : "/TEAMS/0/TEAM_2_CONTAINED_S|Id",
		fetchPredicates : {
			"/TEAMS/0" : "tea_busi.TEAM"
		},
		editUrl : "TEAMS(~0)/TEAM_2_CONTAINED_S"
	}, { // navigation from singleton to single contained entity
		path : "/Me/EMPLOYEE_2_CONTAINED_S|Id",
		editUrl : "Me/EMPLOYEE_2_CONTAINED_S"
	}, { // navigation to contained entity within a collection
		path : "/TEAMS/0/TEAM_2_CONTAINED_C/1|Id",
		fetchPredicates : {
			"/TEAMS/0" : "tea_busi.TEAM",
			"/TEAMS/0/TEAM_2_CONTAINED_C/1" : "tea_busi.ContainedC"
		},
		editUrl : "TEAMS(~0)/TEAM_2_CONTAINED_C(~1)"
	}, { // navigation to contained entity with a key predicate
		path : "/TEAMS('42')/TEAM_2_CONTAINED_C('foo')|Id",
		editUrl : "TEAMS('42')/TEAM_2_CONTAINED_C('foo')"
	}, { // navigation from contained entity to contained entity
		path : "/TEAMS/0/TEAM_2_CONTAINED_S/S_2_C/1|Id",
		fetchPredicates : {
			"/TEAMS/0" : "tea_busi.TEAM",
			"/TEAMS/0/TEAM_2_CONTAINED_S/S_2_C/1" : "tea_busi.ContainedC"
		},
		editUrl : "TEAMS(~0)/TEAM_2_CONTAINED_S/S_2_C(~1)"
	}, { // navigation from contained to root entity, resolved via navigation property binding path
		path : "/TEAMS/0/TEAM_2_CONTAINED_S/S_2_EMPLOYEE|ID",
		fetchPredicates : {
			"/TEAMS/0/TEAM_2_CONTAINED_S/S_2_EMPLOYEE" : "tea_busi.Worker"
		},
		editUrl : "EMPLOYEES(~0)"
	}, { // navigation from entity w/ key predicate to contained to root entity
		path : "/TEAMS('42')/TEAM_2_CONTAINED_C/5/C_2_EMPLOYEE|ID",
		fetchPredicates : {
			"/TEAMS('42')/TEAM_2_CONTAINED_C/5" : "tea_busi.ContainedC"
		},
		editUrl : "TEAMS('42')/TEAM_2_CONTAINED_C(~0)/C_2_EMPLOYEE"
	}, { // decode entity set initially, encode it finally
		path : "/T%E2%82%ACAMS/0|Name",
		fetchPredicates : {
			"/T%E2%82%ACAMS/0" : "tea_busi.TEAM"
		},
		editUrl : "T%E2%82%ACAMS(~0)"
	}, { // decode navigation property, encode entity set
		path : "/EMPLOYEES('7')/EMPLOYEE_2_EQUIPM%E2%82%ACNTS(42)|ID",
		editUrl : "EQUIPM%E2%82%ACNTS(42)"
	}].forEach(function (oFixture) {
		QUnit.test("fetchUpdateData: " + oFixture.path, function (assert) {
			var i = oFixture.path.indexOf("|"),
				sContextPath = oFixture.path.slice(0, i),
				sPropertyPath = oFixture.path.slice(i + 1),
				oContext = Context.create(this.oModel, undefined, sContextPath),
				oContextMock = this.mock(oContext),
				oPromise,
				that = this;

			this.oMetaModelMock.expects("getMetaPath")
				.withExactArgs(oFixture.path.replace("|", "/")).returns("~");
			this.oMetaModelMock.expects("fetchObject").withExactArgs("~")
				.returns(SyncPromise.resolve(Promise.resolve()).then(function () {
					that.oMetaModelMock.expects("fetchEntityContainer")
						.returns(SyncPromise.resolve(mScope));
					Object.keys(oFixture.fetchPredicates || {}).forEach(function (sPath, i) {
						var oEntityInstance = {"@$ui5._" : {"predicate" : "(~" + i + ")"}};

						// Note: the entity instance is delivered asynchronously
						oContextMock.expects("fetchValue")
							.withExactArgs(sPath)
							.returns(SyncPromise.resolve(Promise.resolve(oEntityInstance)));
					});
				}));

			// code under test
			oPromise = this.oMetaModel.fetchUpdateData(sPropertyPath, oContext);

			assert.ok(!oPromise.isRejected());
			return oPromise.then(function (oResult) {
				assert.strictEqual(oResult.editUrl, oFixture.editUrl);
				assert.strictEqual(oResult.entityPath, sContextPath);
				assert.strictEqual(oResult.propertyPath, sPropertyPath);
			});
		});
	});
	//TODO support collection properties (-> path containing index not leading to predicate)
	//TODO prefer instance annotation at payload for "odata.editLink"?!
	//TODO target URLs like "com.sap.gateway.default.iwbep.tea_busi_product.v0001.Container/Products(...)"?
	//TODO type casts, operations?

	//*********************************************************************************************
	QUnit.test("fetchUpdateData: transient entity", function(assert) {
		var oContext = Context.create(this.oModel, undefined, "/TEAMS/-1"),
			sPropertyPath = "Name";

		this.oMetaModelMock.expects("fetchEntityContainer").twice()
			.returns(SyncPromise.resolve(mScope));
		this.mock(oContext).expects("fetchValue").withExactArgs("/TEAMS/-1")
			.returns(SyncPromise.resolve({"@$ui5._" : {"transient" : "update"}}));

		// code under test
		return this.oMetaModel.fetchUpdateData(sPropertyPath, oContext).then(function (oResult) {
			assert.deepEqual(oResult, {
				entityPath : "/TEAMS/-1",
				editUrl : undefined,
				propertyPath : "Name"
			});
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchUpdateData: fetchObject fails", function(assert) {
		var oModel = this.oModel,
			oContext = {
				getModel : function () { return oModel; }
			},
			oExpectedError = new Error(),
			oMetaModelMock = this.mock(this.oMetaModel),
			sPath = "some/invalid/path/to/a/property";

		this.mock(oModel).expects("resolve")
			.withExactArgs(sPath, sinon.match.same(oContext))
			.returns("~1");
		oMetaModelMock.expects("getMetaPath").withExactArgs("~1").returns("~2");
		oMetaModelMock.expects("fetchObject").withExactArgs("~2")
			.returns(Promise.reject(oExpectedError));

		// code under test
		return this.oMetaModel.fetchUpdateData(sPath, oContext).then(function () {
			assert.ok(false);
		}, function (oError) {
			assert.strictEqual(oError, oExpectedError);
		});
	});

	//*********************************************************************************************
	[{
		dataPath : "/Foo/Bar",
		message : "Not an entity set: Foo",
		warning : "Unknown child Foo of tea_busi.DefaultContainer"
	}, {
		dataPath : "/TEAMS/0/Foo/Bar",
		message : "Not a (navigation) property: Foo"
	}, {
		dataPath : "/TEAMS/0/TEAM_2_CONTAINED_S",
		instance : undefined,
		message : "No instance to calculate key predicate at /TEAMS/0"
	}, {
		dataPath : "/TEAMS/0/TEAM_2_CONTAINED_S",
		instance : {},
		message : "No key predicate known at /TEAMS/0"
	}, {
		dataPath : "/TEAMS/0/TEAM_2_CONTAINED_S",
		instance : new Error("failed to load team"),
		message : "failed to load team at /TEAMS/0"
	}].forEach(function (oFixture) {
		QUnit.test("fetchUpdateData: " + oFixture.message, function (assert) {
			var oContext = Context.create(this.oModel, undefined, oFixture.dataPath),
				oPromise;

			this.oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
				.returns(SyncPromise.resolve(mScope));
			if ("instance" in oFixture) {
				this.mock(oContext).expects("fetchValue")
					.returns(oFixture.instance instanceof Error
						? SyncPromise.reject(oFixture.instance)
						: SyncPromise.resolve(oFixture.instance));
			}
			if (oFixture.warning) {
				this.oLogMock.expects("isLoggable")
					.withExactArgs(Log.Level.WARNING, sODataMetaModel)
					.returns(true);
				this.oLogMock.expects("warning")
					.withExactArgs(oFixture.warning, oFixture.dataPath, sODataMetaModel);
			}
			this.mock(this.oModel).expects("reportError")
				.withExactArgs(oFixture.message, sODataMetaModel, sinon.match({
					message : oFixture.dataPath + ": " + oFixture.message,
					name : "Error"
				}));

			oPromise = this.oMetaModel.fetchUpdateData("", oContext);
			assert.ok(oPromise.isRejected());
			assert.strictEqual(oPromise.getResult().message,
				oFixture.dataPath + ": " + oFixture.message);
			oPromise.caught(); // avoid "Uncaught (in promise)"
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchCanonicalPath: success", function(assert) {
		var oContext = {};

		this.mock(this.oMetaModel).expects("fetchUpdateData")
			.withExactArgs("", sinon.match.same(oContext))
			.returns(SyncPromise.resolve(Promise.resolve({
				editUrl : "edit('URL')",
				propertyPath : ""
			})));

		// code under test
		return this.oMetaModel.fetchCanonicalPath(oContext).then(function (oCanonicalPath) {
			assert.strictEqual(oCanonicalPath, "/edit('URL')");
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchCanonicalPath: not an entity", function(assert) {
		var oContext = {
				getPath : function () { return "/TEAMS('4711')/Name"; }
			};

		this.mock(this.oMetaModel).expects("fetchUpdateData")
			.withExactArgs("", sinon.match.same(oContext))
			.returns(SyncPromise.resolve(Promise.resolve({
				entityPath : "/TEAMS('4711')",
				editUrl : "TEAMS('4711')",
				propertyPath : "Name"
			})));

		// code under test
		return this.oMetaModel.fetchCanonicalPath(oContext).then(function () {
			assert.ok(false);
		}, function (oError) {
			assert.strictEqual(oError.message, "Context " + oContext.getPath()
				+ " does not point to an entity. It should be " + "/TEAMS('4711')");
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchCanonicalPath: fetchUpdateData fails", function(assert) {
		var oContext = {},
			oExpectedError = new Error();

		this.mock(this.oMetaModel).expects("fetchUpdateData")
			.withExactArgs("", sinon.match.same(oContext))
			.returns(SyncPromise.resolve(Promise.reject(oExpectedError)));

		// code under test
		return this.oMetaModel.fetchCanonicalPath(oContext).then(function () {
			assert.ok(false);
		}, function (oError) {
			assert.strictEqual(oError, oExpectedError);
		});
	});

	//*********************************************************************************************
	QUnit.test("getProperty = getObject", function (assert) {
		assert.strictEqual(this.oMetaModel.getProperty, this.oMetaModel.getObject);
	});

	//*********************************************************************************************
	QUnit.test("bindProperty", function (assert) {
		var oBinding,
			oContext = {},
			mParameters = {},
			sPath = "foo";

		// code under test
		oBinding = this.oMetaModel.bindProperty(sPath, oContext, mParameters);

		assert.ok(oBinding instanceof PropertyBinding);
		assert.ok(oBinding.hasOwnProperty("vValue"));
		assert.strictEqual(oBinding.getContext(), oContext);
		assert.strictEqual(oBinding.getModel(), this.oMetaModel);
		assert.strictEqual(oBinding.getPath(), sPath);
		assert.strictEqual(oBinding.mParameters, mParameters, "mParameters available internally");
		assert.strictEqual(oBinding.getValue(), undefined);

		// code under test: must not call getProperty() again!
		assert.strictEqual(oBinding.getExternalValue(), undefined);

		// code under test
		assert.throws(function () {
			oBinding.setExternalValue("foo");
		}, /Unsupported operation: ODataMetaPropertyBinding#setValue/);
	});

	//*********************************************************************************************
	[undefined, {}, {$$valueAsPromise : false}].forEach(function (mParameters, i) {
		QUnit.test("ODataMetaPropertyBinding#checkUpdate: " + i, function (assert) {
			var oBinding,
				oContext = {},
				sPath = "foo",
				oValue = {},
				oPromise = SyncPromise.resolve(Promise.resolve(oValue));

			oBinding = this.oMetaModel.bindProperty(sPath, oContext, mParameters);

			this.oMetaModelMock.expects("fetchObject")
				.withExactArgs(sPath, sinon.match.same(oContext), sinon.match.same(mParameters))
				.returns(oPromise);
			this.mock(oBinding).expects("_fireChange")
				.withExactArgs({reason : ChangeReason.Change});

			// code under test
			oBinding.checkUpdate();

			assert.strictEqual(oBinding.getValue(), undefined);
			oPromise.then(function () {
				assert.strictEqual(oBinding.getValue(), oValue);
			});

			return oPromise;
		});
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaPropertyBinding#checkUpdate: $$valueAsPromise=true, sync",
			function (assert) {
		var oBinding,
			oContext = {},
			mParameters = {$$valueAsPromise : true},
			sPath = "foo",
			oValue = {},
			oPromise = SyncPromise.resolve(oValue);

		oBinding = this.oMetaModel.bindProperty(sPath, oContext, mParameters);

		this.oMetaModelMock.expects("fetchObject")
			.withExactArgs(sPath, sinon.match.same(oContext), sinon.match.same(mParameters))
			.returns(oPromise);
		this.mock(oBinding).expects("_fireChange").withExactArgs({reason : ChangeReason.Change});

		// code under test
		oBinding.checkUpdate();

		assert.strictEqual(oBinding.getValue(), oValue, "Value sync");

		return oPromise;
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaPropertyBinding#checkUpdate: no event", function (assert) {
		var oBinding,
			oContext = {},
			mParameters = {},
			sPath = "foo",
			oValue = {},
			oPromise = SyncPromise.resolve(Promise.resolve(oValue));

		oBinding = this.oMetaModel.bindProperty(sPath, oContext, mParameters);
		oBinding.vValue = oValue;

		this.oMetaModelMock.expects("fetchObject")
			.withExactArgs(sPath, sinon.match.same(oContext), sinon.match.same(mParameters))
			.returns(oPromise);
		this.mock(oBinding).expects("_fireChange").never();

		// code under test
		oBinding.checkUpdate();

		return oPromise;
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaPropertyBinding#checkUpdate: bForceUpdate, sChangeReason",
			function (assert) {
		var oBinding,
			oContext = {},
			mParameters = {},
			sPath = "foo",
			oValue = {},
			oPromise = SyncPromise.resolve(Promise.resolve(oValue));

		oBinding = this.oMetaModel.bindProperty(sPath, oContext, mParameters);
		oBinding.vValue = oValue;

		this.oMetaModelMock.expects("fetchObject")
			.withExactArgs(sPath, sinon.match.same(oContext), sinon.match.same(mParameters))
			.returns(oPromise);
		this.mock(oBinding).expects("_fireChange").withExactArgs({reason : "Foo"});

		// code under test
		oBinding.checkUpdate(true, "Foo");

		return oPromise;
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaPropertyBinding#checkUpdate: $$valueAsPromise = true", function (assert) {
		var oBinding,
			oContext = {},
			mParameters = {
				$$valueAsPromise : true
			},
			sPath = "foo",
			oValue = {},
			oPromise,
			oSyncPromise = SyncPromise.resolve(Promise.resolve(oValue));

		oBinding = this.oMetaModel.bindProperty(sPath, oContext, mParameters);

		this.oMetaModelMock.expects("fetchObject")
			.withExactArgs(sPath, sinon.match.same(oContext), sinon.match.same(mParameters))
			.returns(oSyncPromise);
		this.mock(oBinding).expects("_fireChange")
			.withExactArgs({reason : ChangeReason.Change})
			.twice()
			.onFirstCall().callsFake(function () {
				oPromise = oBinding.getValue();
				assert.ok(oPromise instanceof Promise, "Value is a Promise");
			})
			.onSecondCall().callsFake(function () {
				assert.strictEqual(oBinding.getValue(), oValue, "Value resolved");
			});

		// code under test - calls oBinding.checkUpdate(true)
		oBinding.initialize();

		assert.strictEqual(oBinding.getValue(), oPromise, "Value is the pending Promise");
		return oPromise.then(function (oResult) {
			assert.strictEqual(oResult, oValue);
			assert.strictEqual(oBinding.getValue(), oValue);
		});
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaPropertyBinding#setContext", function (assert) {
		var oBinding,
			oBindingMock,
			oContext = {};

		oBinding = this.oMetaModel.bindProperty("Foo", oContext);
		oBindingMock = this.mock(oBinding);

		oBindingMock.expects("checkUpdate").never();

		// code under test
		oBinding.setContext(oContext);

		oBindingMock.expects("checkUpdate").withExactArgs(false, ChangeReason.Context);

		// code under test
		oBinding.setContext(undefined);
		assert.strictEqual(oBinding.getContext(), undefined);

		oBinding = this.oMetaModel.bindProperty("/Foo");
		this.mock(oBinding).expects("checkUpdate").never();

		// code under test
		oBinding.setContext(oContext);
	});

	//*********************************************************************************************
	["ENTRYDATE", "/EMPLOYEES/ENTRYDATE"].forEach(function (sPath) {
		QUnit.test("bindContext: " + sPath, function (assert) {
			var bAbsolutePath = sPath[0] === "/",
				oBinding,
				oBoundContext,
				iChangeCount = 0,
				oContext = this.oMetaModel.getMetaContext("/EMPLOYEES"),
				oContextCopy = this.oMetaModel.getMetaContext("/EMPLOYEES"),
				oNewContext = this.oMetaModel.getMetaContext("/T€AMS");

			// without context
			oBinding = this.oMetaModel.bindContext(sPath, null);

			assert.ok(oBinding instanceof ContextBinding);
			assert.strictEqual(oBinding.getModel(), this.oMetaModel);
			assert.strictEqual(oBinding.getPath(), sPath);
			assert.strictEqual(oBinding.getContext(), null);

			assert.strictEqual(oBinding.isInitial(), true);
			assert.strictEqual(oBinding.getBoundContext(), null);

			// with context
			oBinding = this.oMetaModel.bindContext(sPath, oContextCopy);

			assert.ok(oBinding instanceof ContextBinding);
			assert.strictEqual(oBinding.getModel(), this.oMetaModel);
			assert.strictEqual(oBinding.getPath(), sPath);
			assert.strictEqual(oBinding.getContext(), oContextCopy);

			assert.strictEqual(oBinding.isInitial(), true);
			assert.strictEqual(oBinding.getBoundContext(), null);

			// setContext **********
			oBinding.attachChange(function (oEvent) {
				assert.strictEqual(oEvent.getId(), "change");
				iChangeCount += 1;
			});

			// code under test
			oBinding.setContext(oContext);

			assert.strictEqual(iChangeCount, 0, "still initial");
			assert.strictEqual(oBinding.isInitial(), true);
			assert.strictEqual(oBinding.getBoundContext(), null);
			assert.strictEqual(oBinding.getContext(), oContext);

			// code under test
			oBinding.initialize();

			assert.strictEqual(iChangeCount, 1, "ManagedObject relies on 'change' event!");
			assert.strictEqual(oBinding.isInitial(), false);
			oBoundContext = oBinding.getBoundContext();
			assert.strictEqual(oBoundContext.getModel(), this.oMetaModel);
			assert.strictEqual(oBoundContext.getPath(),
				bAbsolutePath ? sPath : oContext.getPath() + "/" + sPath);

			// code under test - same context
			oBinding.setContext(oContext);

			assert.strictEqual(iChangeCount, 1, "context unchanged");
			assert.strictEqual(oBinding.getBoundContext(), oBoundContext);

			// code under test
			oBinding.setContext(oContextCopy);

			assert.strictEqual(iChangeCount, 1, "context unchanged");
			assert.strictEqual(oBinding.getBoundContext(), oBoundContext);

			// code under test
			// Note: checks equality on resolved path, not simply object identity of context!
			oBinding.setContext(oNewContext);

			if (bAbsolutePath) {
				assert.strictEqual(iChangeCount, 1, "context unchanged");
				assert.strictEqual(oBinding.getBoundContext(), oBoundContext);
			} else {
				assert.strictEqual(iChangeCount, 2, "context changed");
				oBoundContext = oBinding.getBoundContext();
				assert.strictEqual(oBoundContext.getModel(), this.oMetaModel);
				assert.strictEqual(oBoundContext.getPath(), oNewContext.getPath() + "/" + sPath);
			}

			// code under test
			oBinding.setContext(null);

			if (bAbsolutePath) {
				assert.strictEqual(iChangeCount, 1, "context unchanged");
				assert.strictEqual(oBinding.getBoundContext(), oBoundContext);
			} else {
				assert.strictEqual(iChangeCount, 3, "context changed");
				assert.strictEqual(oBinding.isInitial(), false);
				assert.strictEqual(oBinding.getBoundContext(), null);
			}
		});
	});

	//*********************************************************************************************
	QUnit.test("bindList", function (assert) {
		var oBinding,
			oContext = this.oMetaModel.getContext("/EMPLOYEES"),
			aFilters = [],
			sPath = "@",
			aSorters = [];

		// avoid request to backend during initialization
		this.oMetaModelMock.expects("fetchObject").returns(SyncPromise.resolve());

		// code under test
		oBinding = this.oMetaModel.bindList(sPath, oContext, aSorters, aFilters);

		assert.ok(oBinding instanceof ClientListBinding);
		assert.strictEqual(oBinding.getModel(), this.oMetaModel);
		assert.strictEqual(oBinding.getPath(), sPath);
		assert.strictEqual(oBinding.getContext(), oContext);
		assert.strictEqual(oBinding.aSorters, aSorters);
		assert.strictEqual(oBinding.aApplicationFilters, aFilters);
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaListBinding#setContexts", function (assert) {
		var oBinding,
			oBindingMock,
			oContext = this.oMetaModel.getContext("/EMPLOYEES"),
			aContexts = [],
			sPath = "path";

		// avoid request to backend during initialization
		this.oMetaModelMock.expects("fetchObject").returns(SyncPromise.resolve());

		oBinding = this.oMetaModel.bindList(sPath, oContext);
		oBindingMock = this.mock(oBinding);

		oBindingMock.expects("updateIndices").withExactArgs();
		oBindingMock.expects("applyFilter").withExactArgs();
		oBindingMock.expects("applySort").withExactArgs();
		oBindingMock.expects("_getLength").withExactArgs().returns(42);

		// code under test
		oBinding.setContexts(aContexts);

		assert.strictEqual(oBinding.oList, aContexts);
		assert.strictEqual(oBinding.iLength, 42);
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaListBinding#update (sync)", function (assert) {
		var oBinding,
			oBindingMock,
			oContext = this.oMetaModel.getContext("/EMPLOYEES"),
			aContexts = [{}],
			sPath = "path";

		// avoid request to backend during initialization
		this.oMetaModelMock.expects("fetchObject").returns(SyncPromise.resolve());

		oBinding = this.oMetaModel.bindList(sPath, oContext);
		oBindingMock = this.mock(oBinding);

		oBindingMock.expects("fetchContexts").withExactArgs()
			.returns(SyncPromise.resolve(aContexts));
		oBindingMock.expects("setContexts").withExactArgs(sinon.match.same(aContexts));
		oBindingMock.expects("_fireChange").never();

		// code under test
		oBinding.update();
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaListBinding#update (async)", function (assert) {
		var done = assert.async(),
			oBinding,
			oBindingMock,
			oContext = this.oMetaModel.getContext("/EMPLOYEES"),
			aContexts = [{}],
			sPath = "path",
			oFetchPromise = SyncPromise.resolve(Promise.resolve()).then(function () {
				// This is expected to happen after the promise is resolved
				oBindingMock.expects("setContexts").withExactArgs(sinon.match.same(aContexts))
					.callThrough();
				oBindingMock.expects("_fireChange").withExactArgs({reason : ChangeReason.Change})
					.callThrough();

				return aContexts;
			}),
			aResult;

		// avoid request to backend during initialization
		this.oMetaModelMock.expects("fetchObject").returns(SyncPromise.resolve());

		oBinding = this.oMetaModel.bindList(sPath, oContext);
		oBindingMock = this.mock(oBinding);

		oBindingMock.expects("fetchContexts").withExactArgs().returns(oFetchPromise);
		oBindingMock.expects("setContexts").withExactArgs(sinon.match(function (aContexts) {
			return aContexts.length === 0 && aContexts.dataRequested === true;
		})).callThrough();
		oBindingMock.expects("_fireChange").never(); // initially

		// code under test
		oBinding.update();

		aResult = oBinding.getContexts();
		assert.strictEqual(aResult.length, 0);
		assert.strictEqual(aResult.dataRequested, true);

		oBinding.attachEventOnce("change", function () {
			aResult = oBinding.getContexts();
			assert.strictEqual(aResult.length, 1);
			assert.strictEqual(aResult[0], aContexts[0]);
			assert.notOk("dataRequested" in aResult);
			done();
		});
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaListBinding#checkUpdate", function (assert) {
		var oBinding,
			oBindingMock,
			oContext = this.oMetaModel.getContext("/"),
			sPath = "";

		// avoid request to backend during initialization
		this.oMetaModelMock.expects("fetchObject").returns(SyncPromise.resolve());

		oBinding = this.oMetaModel.bindList(sPath, oContext);
		oBindingMock = this.mock(oBinding);

		this.mock(oBinding).expects("update").thrice().callsFake(function () {
			this.oList = [{/*a context*/}];
		});

		oBindingMock.expects("_fireChange").withExactArgs({reason : ChangeReason.Change});

		// code under test
		oBinding.checkUpdate();

		// code under test: The second call must call update, but not fire an event
		oBinding.checkUpdate();

		oBindingMock.expects("_fireChange").withExactArgs({reason : ChangeReason.Change});

		// code under test: Must fire a change event
		oBinding.checkUpdate(true);
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaListBinding#getContexts, getCurrentContexts", function (assert) {
		var oBinding,
			oMetaModel = this.oMetaModel, // instead of "that = this"
			oContext = oMetaModel.getMetaContext("/EMPLOYEES"),
			sPath = "";

		function assertContextPaths(aContexts, aPaths) {
			assert.notOk("diff" in aContexts, "extended change detection is ignored");
			assert.deepEqual(aContexts.map(function (oContext) {
				assert.strictEqual(oContext.getModel(), oMetaModel);
				return oContext.getPath().replace("/EMPLOYEES/", "");
			}), aPaths);
			assert.deepEqual(oBinding.getCurrentContexts(), aContexts);
		}

		this.oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
			.returns(SyncPromise.resolve(mScope));
		oBinding = oMetaModel.bindList(sPath, oContext);

		// code under test: should be ignored
		oBinding.enableExtendedChangeDetection();

		assertContextPaths(oBinding.getContexts(0, 2), ["ID", "AGE"]);
		assertContextPaths(oBinding.getContexts(1, 2), ["AGE", "EMPLOYEE_2_CONTAINED_S"]);
		assertContextPaths(oBinding.getContexts(), ["ID", "AGE", "EMPLOYEE_2_CONTAINED_S",
			"EMPLOYEE_2_EQUIPM€NTS", "EMPLOYEE_2_TEAM", "SALÃRY"]);
		assertContextPaths(oBinding.getContexts(0, 10), ["ID", "AGE", "EMPLOYEE_2_CONTAINED_S",
			"EMPLOYEE_2_EQUIPM€NTS", "EMPLOYEE_2_TEAM", "SALÃRY"]);

		oMetaModel.setSizeLimit(2);
		assertContextPaths(oBinding.getContexts(), ["ID", "AGE"]);

		oBinding.attachEvent("sort", function () {
			assert.ok(false, "unexpected sort event");
		});

		oMetaModel.setSizeLimit(100);
		oBinding.sort(new Sorter("@sapui.name"));
		assertContextPaths(oBinding.getContexts(), ["AGE", "EMPLOYEE_2_CONTAINED_S",
			"EMPLOYEE_2_EQUIPM€NTS", "EMPLOYEE_2_TEAM", "ID", "SALÃRY"]);

		oBinding.attachEvent("filter", function () {
			assert.ok(false, "unexpected filter event");
		});

		oBinding.filter(new Filter("$kind", "EQ", "Property"));
		assertContextPaths(oBinding.getContexts(), ["AGE", "ID", "SALÃRY"]);
	});

	//*********************************************************************************************
	[{
		contextPath : undefined,
		metaPath : "@",
		result : []
	}, {
		// <template:repeat list="{entitySet>}" ...>
		// Iterate all OData path segments, i.e. (navigation) properties.
		// Implicit $Type insertion happens here!
		//TODO support for $BaseType
		contextPath : "/EMPLOYEES",
		metaPath : "",
		result : [
			"/EMPLOYEES/ID",
			"/EMPLOYEES/AGE",
			"/EMPLOYEES/EMPLOYEE_2_CONTAINED_S",
			"/EMPLOYEES/EMPLOYEE_2_EQUIPM€NTS",
			"/EMPLOYEES/EMPLOYEE_2_TEAM",
			"/EMPLOYEES/SALÃRY"
		]
	}, {
		// <template:repeat list="{meta>EMPLOYEES/}" ...>
		// same as before, but with non-empty path and a trailing slash
		contextPath : "/",
		metaPath : "EMPLOYEES/",
		result : [
			"/EMPLOYEES/ID",
			"/EMPLOYEES/AGE",
			"/EMPLOYEES/EMPLOYEE_2_CONTAINED_S",
			"/EMPLOYEES/EMPLOYEE_2_EQUIPM€NTS",
			"/EMPLOYEES/EMPLOYEE_2_TEAM",
			"/EMPLOYEES/SALÃRY"
		]
	}, {
		// <template:repeat list="{meta>/}" ...>
		// Iterate all OData path segments, i.e. entity sets and imports.
		// Implicit scope lookup happens here!
		metaPath : "/",
		result :[
			"/ChangeManagerOfTeam",
			"/EMPLOYEES",
			"/EQUIPM€NTS",
			"/GetEmployeeMaxAge",
			"/Me",
			"/OverloadedAction",
			"/TEAMS",
			"/T€AMS",
			"/VoidAction"
		]
	}, {
		// <template:repeat list="{property>@}" ...>
		// Iterate all external targeting annotations.
		contextPath : "/T€AMS/Team_Id",
		metaPath : "@",
		result : [
			"/T€AMS/Team_Id@Common.Label",
			"/T€AMS/Team_Id@Common.Text",
			"/T€AMS/Team_Id@Common.Text@UI.TextArrangement"
		]
	}, {
		// <template:repeat list="{property>@}" ...>
		// Iterate all external targeting annotations.
		contextPath : "/T€AMS/Name",
		metaPath : "@",
		result : []
	}, {
		// <template:repeat list="{field>./@}" ...>
		// Iterate all inline annotations.
		contextPath : "/T€AMS/$Type/@UI.LineItem/0",
		metaPath : "./@",
		result : [
			"/T€AMS/$Type/@UI.LineItem/0/@UI.Importance"
		]
	}, {
		// <template:repeat list="{at>}" ...>
		// Iterate all inline annotations (edge case with empty relative path).
		contextPath : "/T€AMS/$Type/@UI.LineItem/0/@",
		metaPath : "",
		result : [
			"/T€AMS/$Type/@UI.LineItem/0/@UI.Importance"
		]
	}, {
		contextPath : undefined,
		metaPath : "/Unknown",
		result : [],
		warning : ["Unknown child Unknown of tea_busi.DefaultContainer", "/Unknown/"]
	}].forEach(function (oFixture) {
		var sPath = oFixture.contextPath
			? oFixture.contextPath + "|"/*make cut more visible*/ + oFixture.metaPath
			: oFixture.metaPath;

		QUnit.test("ODataMetaListBinding#fetchContexts (sync): " + sPath, function (assert) {
			var oBinding,
				oMetaModel = this.oMetaModel, // instead of "that = this"
				oContext = oFixture.contextPath && oMetaModel.getContext(oFixture.contextPath);

			if (oFixture.warning) {
				// Note that _getContexts is called twice in this test: once from bindList via the
				// constructor, once directly from the test
				this.oLogMock.expects("isLoggable").twice()
					.withExactArgs(Log.Level.WARNING, sODataMetaModel)
					.returns(true);
				this.oLogMock.expects("warning").twice()
					.withExactArgs(oFixture.warning[0], oFixture.warning[1], sODataMetaModel);
			}
			this.oMetaModelMock.expects("fetchEntityContainer").atLeast(0)
				.returns(SyncPromise.resolve(mScope));
			oBinding = this.oMetaModel.bindList(oFixture.metaPath, oContext);

			// code under test
			assert.deepEqual(oBinding.fetchContexts().getResult().map(function (oContext) {
				assert.strictEqual(oContext.getModel(), oMetaModel);
				return oContext.getPath();
			}), oFixture.result);
		});
	});

	//*********************************************************************************************
	QUnit.test("ODataMetaListBinding#fetchContexts (async)", function (assert) {
		var oBinding,
			oMetaModel = this.oMetaModel,
			sPath = "/foo";

		// Note that fetchObject is called twice in this test: once from bindList via the
		// constructor, once from fetchContexts
		this.oMetaModelMock.expects("fetchObject").twice()
			.withExactArgs(sPath + "/")
			.returns(SyncPromise.resolve(Promise.resolve({bar: "", baz: ""})));
		oBinding = this.oMetaModel.bindList(sPath);

		return oBinding.fetchContexts().then(function (oResult) {
			assert.deepEqual(oResult.map(function (oContext) {
				assert.strictEqual(oContext.getModel(), oMetaModel);
				return oContext.getPath();
			}), ["/foo/bar", "/foo/baz"]);
		});
	});
	//TODO iterate mix of inline and external targeting annotations
	//TODO iterate annotations like "foo@..." for our special cases, e.g. annotations of annotation

	//*********************************************************************************************
	QUnit.test("events", function (assert) {
		assert.throws(function () {
			this.oMetaModel.attachParseError();
		}, new Error("Unsupported event 'parseError': v4.ODataMetaModel#attachEvent"));

		assert.throws(function () {
			this.oMetaModel.attachRequestCompleted();
		}, new Error("Unsupported event 'requestCompleted': v4.ODataMetaModel#attachEvent"));

		assert.throws(function () {
			this.oMetaModel.attachRequestFailed();
		}, new Error("Unsupported event 'requestFailed': v4.ODataMetaModel#attachEvent"));

		assert.throws(function () {
			this.oMetaModel.attachRequestSent();
		}, new Error("Unsupported event 'requestSent': v4.ODataMetaModel#attachEvent"));
	});

	//*********************************************************************************************
	QUnit.test("validate: mSchema2MetadataUrl", function (assert) {
		var mScope = {
				"$Version" : "4.0",
				"$Reference" : {
					"/A/$metadata" : {
						"$Include" : [
							"A.", "A.A."
						]
					},
					"/B/$metadata" : {
						"$Include" : [
							"B.", "B.B."
						]
					},
					"/C/$metadata" : {
						"$Include" : ["C."]
					},
					"../../../../default/iwbep/tea_busi_product/0001/$metadata" : {
						"$Include" : [
							"tea_busi_product."
						]
					}
				}
			},
			sUrl = "/~/$metadata";

		assert.deepEqual(this.oMetaModel.mSchema2MetadataUrl, {});

		// simulate a previous reference to a schema with the _same_ reference URI --> allowed!
		this.oMetaModel.mSchema2MetadataUrl["A."] = {"/A/$metadata" : false};
		// simulate a previous reference to a schema with the _different_ reference URI
		// --> allowed as long as the document is not yet read (and will never be read)
		this.oMetaModel.mSchema2MetadataUrl["B.B."] = {"/B/V2/$metadata" : false};
		// simulate a previous reference to a schema with the _same_ reference URI, already loaded
		this.oMetaModel.mSchema2MetadataUrl["C."] = {"/C/$metadata" : true};

		// code under test
		assert.strictEqual(this.oMetaModel.validate(sUrl, mScope), mScope);

		assert.deepEqual(this.oMetaModel.mSchema2MetadataUrl, {
			"A." : {"/A/$metadata" : false},
			"A.A." : {"/A/$metadata" : false},
			"B." : {"/B/$metadata" : false},
			"B.B." : {
				"/B/$metadata" : false,
				"/B/V2/$metadata" : false
			},
			"C." : {"/C/$metadata" : true},
			"tea_busi_product." : {"/a/default/iwbep/tea_busi_product/0001/$metadata" : false}
		});
	});

	//*********************************************************************************************
	QUnit.test("getLastModified", function (assert) {
		var mEmptyScope = {
				"$Version" : "4.0"
			},
			mNewScope = {
				"$Version" : "4.0",
				"$Date" : "Tue, 18 Apr 2017 14:40:29 GMT"
			},
			iNow = Date.now(),
			mOldScope = {
				"$Version" : "4.0",
				"$Date" : "Tue, 18 Apr 2017 14:40:29 GMT", // $LastModified wins!
				"$LastModified" : "Fri, 07 Apr 2017 11:21:50 GMT"
			},
			mOldScopeClone = clone(mOldScope),
			sUrl = "/~/$metadata"; // Note: in real life, each URL is read at most once!

		// code under test (together with c'tor)
		assert.strictEqual(this.oMetaModel.getLastModified().getTime(), 0, "initial value");

		// code under test
		assert.strictEqual(this.oMetaModel.validate(sUrl, mOldScope), mOldScope);

		assert.strictEqual(this.oMetaModel.getLastModified().toISOString(),
			"2017-04-07T11:21:50.000Z", "old $LastModified is used");
		assert.notOk("$LastModified" in mOldScope);

		// code under test
		assert.strictEqual(this.oMetaModel.validate(sUrl, mNewScope), mNewScope);

		assert.strictEqual(this.oMetaModel.getLastModified().toISOString(),
			"2017-04-18T14:40:29.000Z", "new $Date is used");
		assert.notOk("$Date" in mNewScope);

		// code under test
		assert.strictEqual(this.oMetaModel.validate(sUrl, mOldScopeClone), mOldScopeClone);

		assert.strictEqual(this.oMetaModel.getLastModified().toISOString(),
			"2017-04-18T14:40:29.000Z", "new $Date wins, old $LastModified is ignored");
		assert.notOk("$LastModified" in mOldScopeClone);

		// code under test
		assert.strictEqual(this.oMetaModel.validate(sUrl, mEmptyScope), mEmptyScope);

		assert.ok(this.oMetaModel.getLastModified().getTime() >= iNow,
			"missing $Date/$LastModified is like 'now': " + this.oMetaModel.getLastModified());
	});

	//*********************************************************************************************
	QUnit.test("getETags", function (assert) {
		var sETag = 'W/"..."',
			mETags,
			that = this;

		function codeUnderTest(sUrl, mScope) {
			// code under test
			assert.strictEqual(that.oMetaModel.validate(sUrl, mScope), mScope);

			assert.notOk("$ETag" in mScope);
			assert.notOk("$LastModified" in mScope);
		}

		// code under test (together with c'tor)
		assert.deepEqual(this.oMetaModel.getETags(), {}, "initial value");

		codeUnderTest("/~/A", {
			"$Version" : "4.0",
			"$LastModified" : "Fri, 07 Apr 2017 11:21:50 GMT"
		});
		codeUnderTest("/~/B", {
			"$Version" : "4.0",
			"$LastModified" : "Tue, 18 Apr 2017 14:40:29 GMT"
		});
		codeUnderTest("/~/C", {
			"$Version" : "4.0"
		});
		codeUnderTest("/~/D", {
			"$Version" : "4.0",
			"$ETag" : sETag
		});

		// code under test
		mETags = this.oMetaModel.getETags();

		assert.deepEqual(mETags, {
			"/~/A" : new Date(Date.UTC(2017, 3, 7, 11, 21, 50)),
			"/~/B" : new Date(Date.UTC(2017, 3, 18, 14, 40, 29)),
			"/~/C" : null,
			"/~/D" : sETag // wins over null!
		});
	});

	//*********************************************************************************************
	[{
		message : "Unsupported IncludeAnnotations",
		scope : {
			"$Version" : "4.0",
			"$Reference" : {
				"/A/$metadata" : {
					"$Include" : [
						"A."
					]
				},
				"/B/$metadata" : {
					"$IncludeAnnotations" : [{
						"$TermNamespace" : "com.sap.vocabularies.Common.v1"
					}]
				}
			}
		}
	}, {
		message : "A schema cannot span more than one document: tea_busi."
			+ " - is both included and defined",
		scope : {
			"$Version" : "4.0",
			"$Reference" : {
				"/B/$metadata" : {
					"$Include" : [
						"foo.", "tea_busi."
					]
				}
			},
			"tea_busi." : {
				"$kind" : "Schema"
			}
		}
	}, {
		message : "A schema cannot span more than one document: existing."
			+ " - expected reference URI /B/v1/$metadata but instead saw /B/v2/$metadata",
		scope : {
			"$Version" : "4.0",
			"$Reference" : {
				"/A/$metadata" : {
					"$Include" : [
						"foo.", "bar."
					]
				},
				"/B/v2/$metadata" : {
					"$Include" : [
						"baz.", "existing."
					]
				}
			}
		}
	}].forEach(function (oFixture) {
		[false, true].forEach(function (bSupportReferences) {
			var sMessage = oFixture.message,
				sTitle = "validate: " + sMessage + ", supportReferences: " + bSupportReferences;

			QUnit.test(sTitle, function (assert) {
				var oError,
					sUrl = "/~/$metadata",
					that = this;

				function codeUnderTest() {
					var oResult = that.oMetaModel.validate(sUrl, oFixture.scope);

					assert.strictEqual(oResult, oFixture.scope);
				}

				this.oMetaModel.bSupportReferences = bSupportReferences;
				// simulate a schema that has been loaded or referenced before
				this.oMetaModel.mSchema2MetadataUrl = {
					// simulate schema that is already read
					"existing." : {"/B/v1/$metadata" : true}
				};
				if (bSupportReferences) {
					oError =  new Error(sUrl + ": " + sMessage);
					this.mock(this.oMetaModel.oModel).expects("reportError")
						.withExactArgs(sMessage, sODataMetaModel, sinon.match({
								message : oError.message,
								name : "Error"
							}
						));
				}

				if (bSupportReferences) {
					assert.throws(codeUnderTest, oError);
				} else {
					codeUnderTest();
				}
			});
		});
	});

	//*********************************************************************************************
	QUnit.test("_mergeAnnotations: without annotation files", function (assert) {
		// Note: target elements have been omitted for brevity
		var mExpectedAnnotations = {
				"same.target" : {
					"@Common.Description" : "",
					"@Common.Label" : {
						"old" : true // Note: no aggregation of properties here!
					},
					"@Common.Text" : ""
				},
				"another.target" : {
					"@Common.Label" : ""
				}
			},
			mScope = {
				"A." : {
					"$kind" : "Schema",
					"$Annotations" : {
						"same.target" : {
							"@Common.Label" : {
								"old" : true
							},
							"@Common.Text" : ""
						}
					}
				},
				"B." : {
					"$kind" : "Schema",
					"$Annotations" : {
						"same.target" : {
							"@Common.Description" : "",
							"@Common.Label" : { // illegal overwrite within $metadata, ignored!
								"new" : true
							}
						},
						"another.target" : {
							"@Common.Label" : ""
						}
					}
				},
				"B.B" : {}
			};

		this.oMetaModelMock.expects("validate")
			.withExactArgs(this.oMetaModel.sUrl, mScope);
		assert.deepEqual(this.oMetaModel.mSchema2MetadataUrl, {});

		// code under test
		this.oMetaModel._mergeAnnotations(mScope, []);

		assert.deepEqual(mScope.$Annotations, mExpectedAnnotations,
			"$Annotations have been shifted and merged from schemas to root");
		assert.notOk("$Annotations" in mScope["A."], "$Annotations removed from schema");
		assert.notOk("$Annotations" in mScope["B."], "$Annotations removed from schema");
		assert.deepEqual(this.oMetaModel.mSchema2MetadataUrl, {
			"A." : {"/a/b/c/d/e/$metadata" : false},
			"B." : {"/a/b/c/d/e/$metadata" : false}
		});
	});

	//*********************************************************************************************
	QUnit.test("_mergeAnnotations: validation failure for $metadata", function (assert) {
		var oError = new Error(),
			mScope = {};

		this.oMetaModelMock.expects("validate")
			.withExactArgs(this.oMetaModel.sUrl, mScope)
			.throws(oError);

		assert.throws(function () {
			// code under test
			this.oMetaModel._mergeAnnotations(mScope, []);
		}, oError);
	});

	//*********************************************************************************************
	QUnit.test("_mergeAnnotations: validation failure in annotation file", function (assert) {
		var oError = new Error(),
			mScope = {},
			mAnnotationScope1 = {},
			mAnnotationScope2 = {};

		this.oMetaModel.aAnnotationUris = ["n/a", "/my/annotation.xml"];
		this.oMetaModelMock.expects("validate")
			.withExactArgs(this.oMetaModel.sUrl, mScope);
		this.oMetaModelMock.expects("validate")
			.withExactArgs("n/a", mAnnotationScope1);
		this.oMetaModelMock.expects("validate")
			.withExactArgs("/my/annotation.xml", mAnnotationScope2)
			.throws(oError);

		assert.throws(function () {
			// code under test
			this.oMetaModel._mergeAnnotations(mScope, [mAnnotationScope1, mAnnotationScope2]);
		}, oError);
	});

	//*********************************************************************************************
	QUnit.test("_mergeAnnotations: with annotation files (legacy)", function (assert) {
		var sNamespace = "com.sap.gateway.default.iwbep.tea_busi.v0001.",
			sWorker = sNamespace + "Worker/",
			sBasicSalaryCurr = sWorker + "SALARY/BASIC_SALARY_CURR",
			sBasicSalaryCurr2 = "another.schema.2.SALARY/BASIC_SALARY_CURR",
			sBonusCurr = sWorker + "SALARY/BONUS_CURR",
			sCommonLabel = "@com.sap.vocabularies.Common.v1.Label",
			sCommonQuickInfo = "@com.sap.vocabularies.Common.v1.QuickInfo",
			sCommonText = "@com.sap.vocabularies.Common.v1.Text",
			sBaseUrl = "/" + window.location.pathname.split("/")[1]
				+ "/test-resources/sap/ui/core/qunit/odata/v4/data/",
			oMetadata = getDataAsJson("metadata.json"),
			oExpectedResult = clone(oMetadata),
			oAnnotation = getDataAsJson("legacy_annotations.json"),
			oAnnotationCopy = clone(oAnnotation);

		function getDataAsJson(sFileName) {
			var oXHR = new XMLHttpRequest();

			oXHR.open("GET", sBaseUrl + sFileName, /*async*/false);
			oXHR.send();

			return JSON.parse(oXHR.response);
		}

		// the examples are unrealistic and only need to work in 'legacy mode'
		this.oMetaModel.bSupportReferences = false;
		this.oMetaModel.aAnnotationUris = ["n/a"];
		this.oMetaModelMock.expects("validate")
			.withExactArgs(this.oMetaModel.sUrl, oMetadata);
		this.oMetaModelMock.expects("validate")
			.withExactArgs("n/a", oAnnotation);

		oExpectedResult.$Annotations = oMetadata[sNamespace].$Annotations;
		delete oExpectedResult[sNamespace].$Annotations;
		// all entries with $kind are merged
		oExpectedResult["my.schema.2.FuGetEmployeeMaxAge"] =
			oAnnotationCopy["my.schema.2.FuGetEmployeeMaxAge"];
		oExpectedResult["my.schema.2.Entity"] =
			oAnnotationCopy["my.schema.2.Entity"];
		oExpectedResult["my.schema.2.DefaultContainer"] =
			oAnnotationCopy["my.schema.2.DefaultContainer"];
		oExpectedResult["my.schema.2."] =
			oAnnotationCopy["my.schema.2."];
		oExpectedResult["another.schema.2."] =
			oAnnotationCopy["another.schema.2."];
		// update annotations
		oExpectedResult.$Annotations[sBasicSalaryCurr][sCommonLabel]
			= oAnnotationCopy["my.schema.2."].$Annotations[sBasicSalaryCurr][sCommonLabel];
		oExpectedResult.$Annotations[sBasicSalaryCurr][sCommonQuickInfo]
			= oAnnotationCopy["my.schema.2."].$Annotations[sBasicSalaryCurr][sCommonQuickInfo];
		oExpectedResult.$Annotations[sBonusCurr][sCommonText]
			= oAnnotationCopy["my.schema.2."].$Annotations[sBonusCurr][sCommonText];
		oExpectedResult.$Annotations[sBasicSalaryCurr2]
			= oAnnotationCopy["another.schema.2."].$Annotations[sBasicSalaryCurr2];
		delete oExpectedResult["my.schema.2."].$Annotations;
		delete oExpectedResult["another.schema.2."].$Annotations;

		// code under test
		this.oMetaModel._mergeAnnotations(oMetadata, [oAnnotation]);

		assert.deepEqual(oMetadata, oExpectedResult, "merged metadata as expected");
	});

	//*********************************************************************************************
	QUnit.test("_mergeAnnotations: with annotation files", function (assert) {
		var mScope0 = {
				"$EntityContainer" : "tea_busi.DefaultContainer",
				"$Reference" : {
					"../../../../default/iwbep/tea_busi_foo/0001/$metadata" : {
						"$Include" : [
							"tea_busi_foo.v0001."
						]
					}
				},
				"$Version" : "4.0",
				"tea_busi." : {
					"$kind" : "Schema",
					"$Annotations" : {
						"tea_busi.DefaultContainer" : {
							"@A" : "from $metadata",
							"@B" : "from $metadata",
							"@C" : "from $metadata"
						},
						"tea_busi.TEAM" : {
							"@D" : ["from $metadata"],
							"@E" : ["from $metadata"],
							"@F" : ["from $metadata"]
						}
					}
				},
				"tea_busi.DefaultContainer" : {
					"$kind" : "EntityContainer"
				},
				"tea_busi.EQUIPMENT" : {
					"$kind" : "EntityType"
				},
				"tea_busi.TEAM" : {
					"$kind" : "EntityType"
				},
				"tea_busi.Worker" : {
					"$kind" : "EntityType"
				}
			},
			mScope1 = {
				"$Version" : "4.0",
				"tea_busi_foo.v0001." : {
					"$kind" : "Schema",
					"$Annotations" : {
						"tea_busi_foo.v0001.Product/Name" : {
							"@Common.Label" : "from $metadata"
						}
					}
				},
				"tea_busi_foo.v0001.Product" : {
					"$kind" : "EntityType",
					"Name" : {
						"$kind" : "Property",
						"$Type" : "Edm.String"
					}
				}
			},
			mAnnotationScope1 = {
				"$Version" : "4.0",
				"foo." : {
					"$kind" : "Schema",
					"$Annotations" : {
						"tea_busi.DefaultContainer" : {
							"@B" : "from annotation #1",
							"@C" : "from annotation #1"
						},
						"tea_busi.TEAM" : {
							"@E" : ["from annotation #1"],
							"@F" : ["from annotation #1"]
						},
						"tea_busi.Worker" : {
							"@From.Annotation" : {
								"$Type" : "some.Record",
								"Label" : "from annotation #1"
							},
							"@From.Annotation1" : "from annotation #1"
						}
					}
				}
			},
			mAnnotationScope2 = {
				"$Version" : "4.0",
				"bar." : {
					"$kind" : "Schema",
					"$Annotations" : {
						"tea_busi.DefaultContainer" : {
							"@C" : "from annotation #2"
						},
						"tea_busi.EQUIPMENT" : {
							"@From.Annotation2" : "from annotation #2"
						},
						"tea_busi.TEAM" : {
							"@F" : ["from annotation #2"]
						},
						"tea_busi.Worker" : {
							"@From.Annotation" : {
								"$Type" : "some.Record",
								"Value" : "from annotation #2"
							}
						},
						"tea_busi_foo.v0001.Product/Name" : {
							"@Common.Label" : "from annotation #2"
						}
					}
				}
			},
			mExpectedScope = {
				"$Annotations" : {
					"tea_busi.DefaultContainer" : {
						"@A" : "from $metadata",
						"@B" : "from annotation #1",
						"@C" : "from annotation #2"
					},
					"tea_busi.EQUIPMENT" : {
						"@From.Annotation2" : "from annotation #2"
					},
					"tea_busi.TEAM" : { // Note: no aggregation of array elements here!
						"@D" : ["from $metadata"],
						"@E" : ["from annotation #1"],
						"@F" : ["from annotation #2"]
					},
					"tea_busi.Worker" : {
						"@From.Annotation" : {
							"$Type" : "some.Record",
							// Note: no "Label" here!
							"Value" : "from annotation #2"
						},
						"@From.Annotation1" : "from annotation #1"
					},
					"tea_busi_foo.v0001.Product/Name" : {
						"@Common.Label" : "from annotation #2"
					}
				},
				"$EntityContainer" : "tea_busi.DefaultContainer",
				"$Reference" : {
					"../../../../default/iwbep/tea_busi_foo/0001/$metadata" : {
						"$Include" : [
							"tea_busi_foo.v0001."
						]
					}
				},
				"$Version" : "4.0",
				"bar." : {
					"$kind" : "Schema"
				},
				"foo." : {
					"$kind" : "Schema"
				},
				"tea_busi." : {
					"$kind" : "Schema"
				},
				"tea_busi.DefaultContainer" : {
					"$kind" : "EntityContainer"
				},
				"tea_busi.EQUIPMENT" : {
					"$kind" : "EntityType"
				},
				"tea_busi.TEAM" : {
					"$kind" : "EntityType"
				},
				"tea_busi.Worker" : {
					"$kind" : "EntityType"
				}
			};

		this.oMetaModel.aAnnotationUris = ["/URI/1", "/URI/2"];
		this.oMetaModelMock.expects("validate")
			.withExactArgs(this.oMetaModel.sUrl, mScope0);
		this.oMetaModelMock.expects("validate")
			.withExactArgs("/URI/1", mAnnotationScope1);
		this.oMetaModelMock.expects("validate")
			.withExactArgs("/URI/2", mAnnotationScope2);
		assert.deepEqual(this.oMetaModel.mSchema2MetadataUrl, {});

		// code under test
		this.oMetaModel._mergeAnnotations(mScope0, [mAnnotationScope1, mAnnotationScope2]);

		assert.deepEqual(mScope0, mExpectedScope);
		assert.strictEqual(mScope0["tea_busi."].$Annotations, undefined);
		assert.strictEqual(mAnnotationScope1["foo."].$Annotations, undefined);
		assert.strictEqual(mAnnotationScope2["bar."].$Annotations, undefined);
		assert.deepEqual(this.oMetaModel.mSchema2MetadataUrl, {
			"bar." : {"/URI/2" : false},
			"foo." : {"/URI/1" : false},
			"tea_busi." : {"/a/b/c/d/e/$metadata" : false}
		});

		// prepare to load "cross-service reference"
		// simulate #validate of mScope0
		this.oMetaModel.mSchema2MetadataUrl["tea_busi_foo.v0001."]
			= {"/a/default/iwbep/tea_busi_foo/0001/$metadata" : false};
		this.oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
			.returns(SyncPromise.resolve(mScope0));
		this.mock(this.oMetaModel.oRequestor).expects("read")
			.withExactArgs("/a/default/iwbep/tea_busi_foo/0001/$metadata")
			.returns(Promise.resolve(mScope1));
		this.oMetaModelMock.expects("validate")
			.withExactArgs("/a/default/iwbep/tea_busi_foo/0001/$metadata", mScope1)
			.returns(mScope1);

		// code under test
		return this.oMetaModel.fetchObject("/tea_busi_foo.v0001.Product/Name@Common.Label")
			.then(function (sLabel) {
				assert.strictEqual(sLabel, "from annotation #2", "not overwritten by $metadata");
			});
	});

	//*********************************************************************************************
	QUnit.test("_mergeAnnotations - error (legacy)", function (assert) {
		var oAnnotation1 = {
				"tea_busi.NewType1" : {
					"$kind" : "EntityType"
				}
			},
			oAnnotation2 = {
				"tea_busi.NewType2" : {
					"$kind" : "EntityType"
				},
				"tea_busi.ExistingType" : {
					"$kind" : "EntityType"
				}
			},
			sMessage = "A schema cannot span more than one document: tea_busi.ExistingType",
			oError = new Error("/my/annotation.xml: " + sMessage),
			oMetadata = {
				"tea_busi.ExistingType" : {
					"$kind" : "EntityType"
				}
			};

		this.oMetaModel.aAnnotationUris = ["n/a", "/my/annotation.xml"];
		// legacy behavior: $Version is not checked, tea_busi.NewType2 is allowed
		this.oMetaModel.bSupportReferences = false;
		this.oMetaModelMock.expects("validate")
			.withExactArgs(this.oMetaModel.sUrl, oMetadata);
		this.oMetaModelMock.expects("validate")
			.withExactArgs("n/a", oAnnotation1);
		this.oMetaModelMock.expects("validate")
			.withExactArgs("/my/annotation.xml", oAnnotation2);
		this.mock(this.oMetaModel.oModel).expects("reportError")
			.withExactArgs(sMessage, sODataMetaModel, sinon.match({
				message : oError.message,
				name : 'Error'
			}));

		assert.throws(function () {
			// code under test
			this.oMetaModel._mergeAnnotations(oMetadata, [oAnnotation1, oAnnotation2]);
		}, oError);
	});

	//*********************************************************************************************
	QUnit.test("_mergeAnnotations - a schema cannot span more than one document",
		function (assert) {
			var oAnnotation = {
					"$Version" : "4.0",
					"tea_busi." : {
						"$kind" : "Schema"
					}
				},
				sMessage = "A schema cannot span more than one document: tea_busi.",
				oError = new Error("/my/annotation.xml: " + sMessage),
				oMetadata = {
					"$Version" : "4.0",
					"tea_busi." : {
						"$kind" : "Schema"
					}
				};

			this.oMetaModel.aAnnotationUris = ["n/a", "/my/annotation.xml"];
			this.mock(this.oMetaModel.oModel).expects("reportError")
				.withExactArgs(sMessage, sODataMetaModel, sinon.match({
						message : oError.message,
						name : 'Error'
					}
				));

			assert.throws(function () {
				// code under test
				this.oMetaModel._mergeAnnotations(oMetadata, [{"$Version" : "4.0"}, oAnnotation]);
			}, new Error("/my/annotation.xml: " + sMessage));
		}
	);

	//*********************************************************************************************
	QUnit.test("getOrCreateValueListModel", function (assert) {
		var oModel = new ODataModel({
				serviceUrl : "/Foo/DataService/",
				synchronizationMode : "None"
			}),
			oMetaModel = oModel.getMetaModel(),
			oValueListModel;

		oModel.oRequestor.mHeaders["X-CSRF-Token"] = "xyz";

		// code under test
		oValueListModel = oMetaModel.getOrCreateValueListModel("../ValueListService/$metadata");

		assert.ok(oValueListModel instanceof ODataModel);
		assert.strictEqual(oValueListModel.sServiceUrl, "/Foo/ValueListService/");
		assert.strictEqual(oValueListModel.getDefaultBindingMode(), BindingMode.OneWay);
		assert.strictEqual(oValueListModel.sOperationMode, OperationMode.Server);
		assert.strictEqual(oValueListModel.oRequestor.mHeaders["X-CSRF-Token"], "xyz");

		// code under test
		assert.strictEqual(oMetaModel.getOrCreateValueListModel("/Foo/ValueListService/$metadata"),
			oValueListModel);

		// code under test
		assert.strictEqual(oValueListModel.getMetaModel()
				.getOrCreateValueListModel("/Foo/ValueListService/$metadata"),
			oValueListModel);

		// code under test
		assert.strictEqual(oValueListModel.getMetaModel().getOrCreateValueListModel("$metadata"),
			oValueListModel);

		oModel = new ODataModel({
			serviceUrl : "/Foo/DataService2/",
			synchronizationMode : "None"
		});

		// code under test - even a totally different model gets the very same value list model
		assert.strictEqual(oModel.getMetaModel()
				.getOrCreateValueListModel("../ValueListService/$metadata"),
			oValueListModel);
	});

	//*********************************************************************************************
	QUnit.test("getOrCreateValueListModel: relative data service URL", function (assert) {
		var sRelativePath = "../../../DataService/",
			sAbsolutePath =
				new URI(sRelativePath).absoluteTo(document.baseURI).pathname().toString(),
			oModel = new ODataModel({
				serviceUrl : sRelativePath,
				synchronizationMode : "None"
			}),
			oValueListModel;

		// code under test
		oValueListModel = oModel.getMetaModel()
			.getOrCreateValueListModel("../ValueListService/$metadata");

		assert.strictEqual(oValueListModel.sServiceUrl,
			new URI("../ValueListService/").absoluteTo(sAbsolutePath).toString());
	});

	//*********************************************************************************************
	QUnit.test("fetchValueListType: unknown property", function (assert) {
		var oContext = {},
			sPath = "/Products('HT-1000')/Foo";

		this.oMetaModelMock.expects("getMetaContext").withExactArgs(sPath).returns(oContext);
		this.oMetaModelMock.expects("fetchObject")
			.withExactArgs(undefined, sinon.match.same(oContext))
			.returns(Promise.resolve());

		// code under test
		return this.oMetaModel.fetchValueListType(sPath).then(function () {
			assert.ok(false);
		}, function (oError) {
			assert.ok(oError.message, "No metadata for " + sPath);
		});
	});

	//*********************************************************************************************
	[{
		mAnnotations : {
			"@some.other.Annotation" : true
		},
		sValueListType : ValueListType.None
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueListReferences" : [],
			"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : true
		},
		sValueListType : ValueListType.Fixed
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueList" : {},
			"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : true
		},
		sValueListType : ValueListType.Fixed
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueListMapping" : {},
			"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : true
		},
		sValueListType : ValueListType.Fixed
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueListReferences" : []
		},
		sValueListType : ValueListType.Standard
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueListReferences#foo" : [],
			"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : false
		},
		sValueListType : ValueListType.Standard
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueList#foo" : {},
			"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : false
		},
		sValueListType : ValueListType.Standard
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueListMapping#foo" : {},
			"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : false
		},
		sValueListType : ValueListType.Standard
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueList#foo" : {
				"SearchSupported" : false
			}
		},
		sValueListType : ValueListType.Fixed
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueList#foo" : {
				"SearchSupported" : true
			}
		},
		sValueListType : ValueListType.Standard
	}, {
		mAnnotations : {
			"@com.sap.vocabularies.Common.v1.ValueList#foo" : {}
		},
		sValueListType : ValueListType.Standard
	}].forEach(function (oFixture) {
		QUnit.test("fetchValueListType: " + JSON.stringify(oFixture.mAnnotations),
				function (assert) {
			var oContext = {},
				sPropertyPath = "/ProductList('HT-1000')/Status";

			this.oMetaModelMock.expects("getMetaContext")
				.withExactArgs(sPropertyPath).returns(oContext);
			this.oMetaModelMock.expects("fetchObject")
				.withExactArgs(undefined, sinon.match.same(oContext))
				.returns(SyncPromise.resolve({}));
			this.oMetaModelMock.expects("getObject")
				.withExactArgs("@", sinon.match.same(oContext))
				.returns(oFixture.mAnnotations);

			// code under test
			this.oMetaModel.fetchValueListType(sPropertyPath).then(function (sValueListType) {
				assert.strictEqual(sValueListType, oFixture.sValueListType);
			});
		});
	});

	//*********************************************************************************************
	QUnit.test("getValueListType, requestValueListType", function (assert) {
		return checkGetAndRequest(this, assert, "fetchValueListType", ["sPath"], true);
	});

	//*********************************************************************************************
	["ValueList", "ValueListMapping"].forEach(function (sValueList) {
		QUnit.test("fetchValueListMappings: " + sValueList + ", success", function (assert) {
			var oAnnotations = {},
				oModel = new ODataModel({
					serviceUrl : "/Foo/DataService/",
					synchronizationMode : "None"
				}),
				oMetaModelMock = this.mock(oModel.getMetaModel()),
				oDefaultMapping = {
					"CollectionPath" : "VH_Category1Set",
					"Parameters" : [{"p1" : "foo"}]
				},
				oFooMapping = {
					"CollectionPath" : "VH_Category2Set",
					"Parameters" : [{"p2" : "bar"}]
				},
				oProperty = {},
				oValueListMetadata = {
					"$Annotations" : {
						"zui5_epm_sample.Product/Category" : oAnnotations,
						"some.other.Target" : {}
					}
				},
				oValueListModel = {
					getMetaModel : function () {
						return {
							fetchEntityContainer : function () {
								return Promise.resolve(oValueListMetadata);
							}
						};
					}
				};

			oAnnotations["@com.sap.vocabularies.Common.v1." + sValueList] = oDefaultMapping;
			oAnnotations["@com.sap.vocabularies.Common.v1." + sValueList + "#foo"] = oFooMapping;
			oMetaModelMock.expects("getObject")
				.withExactArgs("/zui5_epm_sample.Product/Category")
				.returns(oProperty);

			// code under test
			return oModel.getMetaModel()
				.fetchValueListMappings(oValueListModel, "zui5_epm_sample", oProperty)
				.then(function (oValueListMappings) {
					assert.deepEqual(oValueListMappings, {
						"" : oDefaultMapping,
						"foo" : oFooMapping
					});
				});
		});
	});

	//*********************************************************************************************
	[{
		annotations : {
			"zui5_epm_sample.Product/CurrencyCode/type.cast" : true
		},
		error : "Unexpected annotation target 'zui5_epm_sample.Product/CurrencyCode/type.cast' " +
			"with namespace of data service in /Foo/ValueListService"
	}, {
		annotations : {
			"zui5_epm_sample.Product/Category" : {
				"@some.other.Term" : true
			}
		},
		error : "Unexpected annotation 'some.other.Term' for target "
			+ "'zui5_epm_sample.Product/Category' with namespace of data service "
			+ "in /Foo/ValueListService"
	}, {
		annotations : {},
		error : "No annotation 'com.sap.vocabularies.Common.v1.ValueList' "
			+ "in /Foo/ValueListService"
	}, {
		annotations : {
			"zui5_epm_sample.Product/Category" : {
				"@com.sap.vocabularies.Common.v1.ValueList" : {
					"CollectionRoot" : "/bar/$metadata"
				}
			}
		},
		error : "Property 'CollectionRoot' is not allowed in annotation "
			+ "'com.sap.vocabularies.Common.v1.ValueList' for target "
			+ "'zui5_epm_sample.Product/Category' in /Foo/ValueListService"
	}, {
		annotations : {
			"zui5_epm_sample.Product/Category" : {
				"@com.sap.vocabularies.Common.v1.ValueList" : {
					"SearchSupported" : false
				}
			}
		},
		error : "Property 'SearchSupported' is not allowed in annotation "
			+ "'com.sap.vocabularies.Common.v1.ValueList' for target "
			+ "'zui5_epm_sample.Product/Category' in /Foo/ValueListService"
	}].forEach(function (oFixture) {
		QUnit.test("fetchValueListMappings: " + oFixture.error, function (assert) {
			var oModel = new ODataModel({
					serviceUrl : "/Foo/DataService/",
					synchronizationMode : "None"
				}),
				oMetaModel = oModel.getMetaModel(),
				oMetaModelMock = this.mock(oMetaModel),
				oProperty = {},
				oValueListMetadata = {
					"$Annotations" : oFixture.annotations
				},
				oValueListModel = {
					getMetaModel : function () {
						return {
							fetchEntityContainer : function () {
								return Promise.resolve(oValueListMetadata);
							}
						};
					},
					sServiceUrl : "/Foo/ValueListService"
				},
				sTarget = Object.keys(oFixture.annotations)[0];

			oMetaModelMock.expects("getObject").atLeast(0)
				.withExactArgs("/" + sTarget)
				.returns(sTarget === "zui5_epm_sample.Product/Category" ? oProperty : undefined);

			// code under test
			return oMetaModel
				.fetchValueListMappings(oValueListModel, "zui5_epm_sample", oProperty)
				.then(function () {
					assert.ok(false);
				}, function (oError) {
					assert.strictEqual(oError.message, oFixture.error);
				});
		});
	});

	//*********************************************************************************************
	["ValueList", "ValueListMapping"].forEach(function (sValueList) {
		QUnit.test("fetchValueListMappings: " + sValueList + ", value list model is data model",
				function (assert) {
			var oAnnotations = {
					"@com.sap.vocabularies.Common.v1.Label" : "Country"
				},
				oModel = new ODataModel({
					serviceUrl : "/Foo/DataService/",
					synchronizationMode : "None"
				}),
				oMetaModelMock = this.mock(oModel.getMetaModel()),
				oMapping = {
					"CollectionPath" : "VH_CountrySet",
					"Parameters" : [{"p1" : "foo"}]
				},
				oProperty = {
					"$kind" : "Property"
				},
				oMetadata = {
					"$EntityContainer" : "value_list.Container",
					"value_list.VH_BusinessPartner" : {
						"$kind" : "Entity",
						"Country" : oProperty
					},
					"$Annotations" : {
						// value list on value list
						"value_list.VH_BusinessPartner/Country" : oAnnotations,
						"value_list.VH_BusinessPartner/Foo" : {/* some other field w/ value list*/}
					}
				};

			oAnnotations["@com.sap.vocabularies.Common.v1." + sValueList] = oMapping;
			oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
				.returns(SyncPromise.resolve(oMetadata));

			// code under test
			return oModel.getMetaModel()
				.fetchValueListMappings(oModel, "value_list", oProperty)
				.then(function (oValueListMappings) {
					assert.deepEqual(oValueListMappings, {
						"" : oMapping
					});
				});
		});
	});

	//*********************************************************************************************
	[{
		sPropertyPath : "/EMPLOYEES/unknown",
		sExpectedError : "No metadata"
	}, {
		sPropertyPath : "/EMPLOYEES/AGE",
		sExpectedError : "No annotation 'com.sap.vocabularies.Common.v1.ValueListReferences'"
	}].forEach(function (oFixture) {
		QUnit.test("requestValueListInfo: " + oFixture.sExpectedError, function (assert) {
			var oModel = new ODataModel({
					serviceUrl : "/~/",
					synchronizationMode : "None"
				});

			this.mock(oModel.getMetaModel()).expects("fetchEntityContainer").atLeast(1)
				.returns(SyncPromise.resolve(mScope));

			// code under test
			return oModel.getMetaModel().requestValueListInfo(oFixture.sPropertyPath)
				.then(function () {
					assert.ok(false);
				}, function (oError) {
					assert.strictEqual(oError.message,
						oFixture.sExpectedError + " for " + oFixture.sPropertyPath);
				});
		});
	});

	//*********************************************************************************************
	[false, true].forEach(function (bDuplicate) {
		QUnit.test("requestValueListInfo: duplicate=" + bDuplicate, function (assert) {
			var sMappingUrl1 = "../ValueListService1/$metadata",
				sMappingUrl2 = "../ValueListService2/$metadata",
				sMappingUrlBar = "../ValueListServiceBar/$metadata",
				oModel = new ODataModel({
					serviceUrl : "/Foo/DataService/",
					synchronizationMode : "None"
				}),
				oMetaModelMock = this.mock(oModel.getMetaModel()),
				oProperty = {
					"$kind" : "Property"
				},
				sPropertyPath = "/ProductList('HT-1000')/Category",
				oMetadata = {
					"$EntityContainer" : "zui5_epm_sample.Container",
					"zui5_epm_sample.Product" : {
						"$kind" : "Entity",
						"Category" : oProperty
					},
					"$Annotations" : {
						"zui5_epm_sample.Product/Category" : {
							"@com.sap.vocabularies.Common.v1.ValueListReferences" :
								[sMappingUrl1, sMappingUrl2],
							"@com.sap.vocabularies.Common.v1.ValueListReferences#bar" :
								[sMappingUrlBar],
							"@com.sap.vocabularies.Common.v1.ValueListReferences#bar@an.Annotation"
								: true,
							"@some.other.Annotation" : true
						}
					},
					"zui5_epm_sample.Container" : {
						"ProductList" : {
							"$kind" : "EntitySet",
							"$Type" : "zui5_epm_sample.Product"
						}
					}
				},
				oValueListMappings1 = {
					"" : {CollectionPath : ""}
				},
				oValueListMappings2 = {
					"foo" : {CollectionPath : "foo"}
				},
				oValueListMappingsBar = {},
				oValueListModel1 = {sServiceUrl : sMappingUrl1},
				oValueListModel2 = {sServiceUrl : sMappingUrl2},
				oValueListModelBar = {sServiceUrl : sMappingUrlBar};

			oValueListMappingsBar[bDuplicate ? "" : "bar"] = {CollectionPath : "bar"};
			oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
				.returns(SyncPromise.resolve(oMetadata));
			oMetaModelMock.expects("getOrCreateValueListModel")
				.withExactArgs(sMappingUrl1)
				.returns(oValueListModel1);
			oMetaModelMock.expects("fetchValueListMappings")
				.withExactArgs(sinon.match.same(oValueListModel1), "zui5_epm_sample",
					sinon.match.same(oProperty))
				.returns(Promise.resolve(oValueListMappings1));
			oMetaModelMock.expects("getOrCreateValueListModel")
				.withExactArgs(sMappingUrl2)
				.returns(oValueListModel2);
			oMetaModelMock.expects("fetchValueListMappings")
				.withExactArgs(sinon.match.same(oValueListModel2), "zui5_epm_sample",
					sinon.match.same(oProperty))
				.returns(Promise.resolve(oValueListMappings2));
			oMetaModelMock.expects("getOrCreateValueListModel")
				.withExactArgs(sMappingUrlBar)
				.returns(oValueListModelBar);
			oMetaModelMock.expects("fetchValueListMappings")
				.withExactArgs(sinon.match.same(oValueListModelBar), "zui5_epm_sample",
					sinon.match.same(oProperty))
				.returns(SyncPromise.resolve(oValueListMappingsBar));

			// code under test
			return oModel.getMetaModel()
				.requestValueListInfo(sPropertyPath)
				.then(function (oResult) {
					assert.ok(!bDuplicate);
					assert.deepEqual(oResult, {
						"" : {
							$model : oValueListModel1,
							CollectionPath : ""
						},
						"foo" : {
							$model : oValueListModel2,
							CollectionPath : "foo"
						},
						"bar" : {
							$model : oValueListModelBar,
							CollectionPath : "bar"
						}
					});
				}, function (oError) {
					assert.ok(bDuplicate);
					assert.strictEqual(oError.message,
						"Annotations 'com.sap.vocabularies.Common.v1.ValueList' with "
						+ "identical qualifier '' for property " + sPropertyPath
						+ " in " + sMappingUrlBar + " and " + sMappingUrl1);
				});
		});
	});

	//*********************************************************************************************
	["ValueList", "ValueListMapping"].forEach(function (sValueList) {
		QUnit.test("requestValueListInfo: " + sValueList + ", same model w/o reference",
				function (assert) {
			var oAnnotations = {},
				oProperty = {
					"$kind" : "Property"
				},
				oValueListMappingFoo = {CollectionPath : "foo"},
				oMetadata = {
					"$EntityContainer" : "value_list.Container",
					"value_list.Container" : {
						"$kind" : "EntityContainer",
						"VH_BusinessPartnerSet" : {
							"$kind" : "EntitySet",
							"$Type" : "value_list.VH_BusinessPartner"
						}
					},
					"value_list.VH_BusinessPartner" : {
						"$kind" : "Entity",
						"Country" : oProperty
					},
					"$Annotations" : {
						"value_list.VH_BusinessPartner/Country" : oAnnotations
					}
				},
				oModel = new ODataModel({
					serviceUrl : "/Foo/ValueListService/",
					synchronizationMode : "None"
				}),
				oMetaModelMock = this.mock(oModel.getMetaModel()),
				sPropertyPath = "/VH_BusinessPartnerSet('0100000000')/Country";

			oAnnotations["@com.sap.vocabularies.Common.v1." + sValueList + "#foo"] =
				oValueListMappingFoo;
			oAnnotations["@com.sap.vocabularies.Common.v1." + sValueList + "#bar"] =
				{CollectionPath : "bar"};
			oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
				.returns(SyncPromise.resolve(oMetadata));

			// code under test
			return oModel.getMetaModel().requestValueListInfo(sPropertyPath).then(
					function (oResult) {
				assert.strictEqual(oResult.foo.$model, oModel);
				assert.strictEqual(oResult.bar.$model, oModel);
				assert.notOk("$model" in oValueListMappingFoo);
				delete oResult.foo.$model;
				delete oResult.bar.$model;
				assert.deepEqual(oResult, {
					"foo" : {CollectionPath : "foo"},
					"bar" : {CollectionPath : "bar"}
				});
			});
		});
	});

	//*********************************************************************************************
	["ValueList", "ValueListMapping"].forEach(function (sValueList) {
		[false, true].forEach(function (bDuplicate) {
			var sTitle = "requestValueListInfo: " + sValueList + ", fixed values: duplicate="
					+ bDuplicate;

			QUnit.test(sTitle, function (assert) {
				var oAnnotations = {
						"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : true
					},
					oMetadata = {
						"$EntityContainer" : "value_list.Container",
						"value_list.Container" : {
							"$kind" : "EntityContainer",
							"VH_BusinessPartnerSet" : {
								"$kind" : "EntitySet",
								"$Type" : "value_list.VH_BusinessPartner"
							}
						},
						"value_list.VH_BusinessPartner" : {
							"$kind" : "Entity",
							"Country" : {}
						},
						"$Annotations" : {
							"value_list.VH_BusinessPartner/Country" : oAnnotations
						}
					},
					oModel = new ODataModel({
						serviceUrl : "/Foo/ValueListService/",
						synchronizationMode : "None"
					}),
					sPropertyPath = "/VH_BusinessPartnerSet('42')/Country";

				oAnnotations["@com.sap.vocabularies.Common.v1." + sValueList + "#foo"] =
					{CollectionPath : "foo"};
				if (bDuplicate) {
					oAnnotations["@com.sap.vocabularies.Common.v1." + sValueList + "#bar"] = {};
				}
				this.mock(oModel.getMetaModel()).expects("fetchEntityContainer").atLeast(1)
					.returns(SyncPromise.resolve(oMetadata));

				// code under test
				return oModel.getMetaModel().requestValueListInfo(sPropertyPath)
					.then(function (oResult) {
						assert.notOk(bDuplicate);
						assert.strictEqual(oResult[""].$model, oModel);
						delete oResult[""].$model;
						assert.deepEqual(oResult, {
							"" : {CollectionPath : "foo"}
						});
					}, function (oError) {
						assert.ok(bDuplicate);
						assert.strictEqual(oError.message, "Annotation "
							+ "'com.sap.vocabularies.Common.v1.ValueListWithFixedValues' but "
							+ "multiple 'com.sap.vocabularies.Common.v1.ValueList' for property "
							+ sPropertyPath);
					});
			});
		});
	});

	//*********************************************************************************************
	QUnit.test("requestValueListInfo: property in cross-service reference", function (assert) {
		var sMappingUrl = "../ValueListService/$metadata",
			oModel = new ODataModel({
				serviceUrl : "/Foo/DataService/",
				synchronizationMode : "None"
			}),
			oMetaModelMock = this.mock(oModel.getMetaModel()),
			oProperty = {
				"$kind" : "Property"
			},
			oMetadata = {
				"$Version" : "4.0",
				"$Reference" : {
					"/Foo/EpmSample/$metadata" : {
						"$Include" : ["zui5_epm_sample."]
					}
				},
				"$EntityContainer" : "base.Container",
				"base.Container" : {
					"BusinessPartnerList" : {
						"$kind" : "EntitySet",
						"$Type" : "base.BusinessPartner"
					}
				},
				"base.BusinessPartner" : {
					"$kind" : "EntityType",
					"BP_2_PRODUCT" : {
						"$kind" : "NavigationProperty",
						"$Type" : "zui5_epm_sample.Product"
					}
				}
			},
			oMetadataProduct = {
				"$Version" : "4.0",
				"zui5_epm_sample.Product" : {
					"$kind" : "Entity",
					"Category" : oProperty
				},
				"zui5_epm_sample." : {
					"$kind" : "Schema",
					"$Annotations" : {
						"zui5_epm_sample.Product/Category" : {
							"@com.sap.vocabularies.Common.v1.ValueListReferences" : [sMappingUrl]
						}
					}
				}
			},
			sPropertyPath = "/BusinessPartnerList('0100000000')/BP_2_PRODUCT('HT-1000')/Category",
			oRequestorMock = this.mock(oModel.oMetaModel.oRequestor),
			oValueListMappings = {
				"" : {CollectionPath : ""}
			},
			oValueListModel = {sServiceUrl : sMappingUrl};

		oRequestorMock.expects("read").withExactArgs("/Foo/DataService/$metadata", false, undefined)
			.returns(Promise.resolve(oMetadata));
		oRequestorMock.expects("read").withExactArgs("/Foo/EpmSample/$metadata")
			.returns(Promise.resolve(oMetadataProduct));
		oMetaModelMock.expects("getOrCreateValueListModel")
			.withExactArgs(sMappingUrl)
			.returns(oValueListModel);
		oMetaModelMock.expects("fetchValueListMappings")
			.withExactArgs(sinon.match.same(oValueListModel), "zui5_epm_sample",
				sinon.match.same(oProperty))
			.returns(Promise.resolve(oValueListMappings));

		// code under test
		return oModel.getMetaModel().requestValueListInfo(sPropertyPath).then(function (oResult) {
			assert.deepEqual(oResult, {
				"" : {
					$model : oValueListModel,
					CollectionPath : ""
				}
			});
		});
	});

	//*********************************************************************************************
	["ValueList", "ValueListMapping"].forEach(function (sValueList) {
		QUnit.test("requestValueListInfo: " + sValueList
				+ ", same qualifier in reference and local", function (assert) {
			var sMappingUrl = "../ValueListService/$metadata",
				oAnnotations = {
					"@com.sap.vocabularies.Common.v1.ValueListReferences" : [sMappingUrl]
				},
				oProperty = {
					"$kind" : "Property"
				},
				oMetadata = {
					"$EntityContainer" : "zui5_epm_sample.Container",
					"zui5_epm_sample.Container" : {
						"$kind" : "EntityContainer",
						"ProductList" : {
							"$kind" : "EntitySet",
							"$Type" : "zui5_epm_sample.Product"
						}
					},
					"zui5_epm_sample.Product" : {
						"$kind" : "Entity",
						"Category" : oProperty
					},
					"$Annotations" : {
						"zui5_epm_sample.Product/Category" : oAnnotations
					}
				},
				oModel = new ODataModel({
					serviceUrl : "/Foo/ValueListService/",
					synchronizationMode : "None"
				}),
				oMetaModelMock = this.mock(oModel.getMetaModel()),
				sPropertyPath = "/ProductList('HT-1000')/Category",
				oValueListModel = {};

			oAnnotations["@com.sap.vocabularies.Common.v1." + sValueList + "#foo"] = {};
			oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
				.returns(SyncPromise.resolve(oMetadata));
			oMetaModelMock.expects("getOrCreateValueListModel")
				.withExactArgs(sMappingUrl)
				.returns(oValueListModel);
			oMetaModelMock.expects("fetchValueListMappings")
				.withExactArgs(sinon.match.same(oValueListModel), "zui5_epm_sample",
					sinon.match.same(oProperty))
				.returns(Promise.resolve({"foo" : {}}));

			// code under test
			return oModel.getMetaModel().requestValueListInfo(sPropertyPath).then(function () {
				assert.ok(false);
			}, function (oError) {
				assert.strictEqual(oError.message,
					"Annotations 'com.sap.vocabularies.Common.v1.ValueList' with identical "
					+ "qualifier 'foo' for property " + sPropertyPath + " in " + sMappingUrl
					+ " and " + oModel.sServiceUrl + "$metadata");
			});
		});
	});

	//*********************************************************************************************
	QUnit.test("requestValueListInfo: ValueList with CollectionRoot in data service",
			function (assert) {
		var sMappingUrl = "../ValueListService/$metadata",
			oModel = new ODataModel({
				serviceUrl : "/Foo/DataService/",
				synchronizationMode : "None"
			}),
			oMetaModelMock = this.mock(oModel.getMetaModel()),
			oProperty = {
				"$kind" : "Property"
			},
			sPropertyPath = "/ProductList('HT-1000')/Category",
			oMetadata = {
				"$EntityContainer" : "zui5_epm_sample.Container",
				"zui5_epm_sample.Product" : {
					"$kind" : "Entity",
					"Category" : oProperty
				},
				"$Annotations" : {
					"zui5_epm_sample.Product/Category" : {
						"@com.sap.vocabularies.Common.v1.ValueList#foo" : {
							"CollectionPath" : "VH_CategorySet",
							"CollectionRoot" : sMappingUrl,
							"SearchSupported" : true
						}
					}
				},
				"zui5_epm_sample.Container" : {
					"ProductList" : {
						"$kind" : "EntitySet",
						"$Type" : "zui5_epm_sample.Product"
					}
				}
			},
			oValueListModel = {"id" : "ValueListModel"}; // for deepEqual

		oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
			.returns(SyncPromise.resolve(oMetadata));
		oMetaModelMock.expects("getOrCreateValueListModel")
			.withExactArgs(sMappingUrl)
			.returns(oValueListModel);

		// code under test
		return oModel.getMetaModel().requestValueListInfo(sPropertyPath).then(function (oResult) {
			assert.deepEqual(oResult, {
				"foo" : {
					$model : oValueListModel,
					CollectionPath : "VH_CategorySet"
				}
			});
			assert.strictEqual(oMetadata.$Annotations["zui5_epm_sample.Product/Category"]
				["@com.sap.vocabularies.Common.v1.ValueList#foo"].CollectionRoot,
				sMappingUrl);
		});
	});

	//*********************************************************************************************
	[false, true].forEach(function (bOverride) {
		QUnit.test("requestValueListInfo: ValueList with CollectionRoot, same qualifier, "
				+ (bOverride ? "override" : "collision"), function (assert) {
			var sCollectionRoot = "", // unrealistic, but enforces "CollectionRoot" in ...
				oProperty = {
					"$kind" : "Property"
				},
				sValueListService = "../ValueListService/$metadata",
				oMetadata = {
					"$EntityContainer" : "zui5_epm_sample.Container",
					"zui5_epm_sample.Product" : {
						"$kind" : "Entity",
						"Category" : oProperty
					},
					"zui5_epm_sample.Container" : {
						"ProductList" : {
							"$kind" : "EntitySet",
							"$Type" : "zui5_epm_sample.Product"
						}
					},
					"$Annotations" : {
						"zui5_epm_sample.Product/Category" : {
							"@com.sap.vocabularies.Common.v1.ValueList#bar" : {
								"CollectionPath" : "foo",
								"CollectionRoot" : sCollectionRoot,
								"Label" : "from data service"
							},
							"@com.sap.vocabularies.Common.v1.ValueListReferences" :
								[sValueListService],
							"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : true
						}
					}
				},
				oModel = new ODataModel({
					serviceUrl : "/Foo/DataService/",
					synchronizationMode : "None"
				}),
				oMetaModelMock = this.mock(oModel.getMetaModel()),
				sPropertyPath = "/ProductList('HT-1000')/Category",
				oValueListModel = {"id" : "ValueListModel"}, // for deepEqual
				oValueListModel2 = bOverride ? oValueListModel : {},
				oValueListMapping = {
					"$model" : oValueListModel,
					"CollectionPath" : "foo",
					"Label" : "from value list service"
				};

			oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
				.returns(SyncPromise.resolve(oMetadata));
			oMetaModelMock.expects("getOrCreateValueListModel")
				.withExactArgs(sValueListService)
				.returns(oValueListModel);
			oMetaModelMock.expects("getOrCreateValueListModel")
				.withExactArgs(sCollectionRoot)
				.returns(oValueListModel2);
			oMetaModelMock.expects("fetchValueListMappings")
				.withExactArgs(sinon.match.same(oValueListModel), "zui5_epm_sample",
					sinon.match.same(oProperty))
				.returns(Promise.resolve({"bar" : oValueListMapping}));

			// code under test
			return oModel.getMetaModel().requestValueListInfo(sPropertyPath)
				.then(function (oResult) {
					assert.strictEqual(bOverride, true);
					assert.deepEqual(oResult, {
						"" : {
							$model : oValueListModel,
							CollectionPath : "foo",
							Label : "from data service"
						}
					});
				}, function (oError) {
					assert.strictEqual(bOverride, false);
					assert.strictEqual(oError.message,
						"Annotations 'com.sap.vocabularies.Common.v1.ValueList' with "
							+ "identical qualifier 'bar' for property " + sPropertyPath
							+ " in " + sValueListService + " and /Foo/DataService/$metadata");
				});
		});
	});

	//*********************************************************************************************
	QUnit.test("requestValueListInfo: ValueListWithFixedValues and ValueList with SearchSupported",
			function (assert) {
		var oModel = new ODataModel({
				serviceUrl : "/Foo/DataService/",
				synchronizationMode : "None"
			}),
			oMetaModelMock = this.mock(oModel.getMetaModel()),
			oProperty = {
				"$kind" : "Property"
			},
			oMetadata = {
				"$EntityContainer" : "zui5_epm_sample.Container",
				"zui5_epm_sample.Product" : {
					"$kind" : "Entity",
					"Category" : oProperty
				},
				"$Annotations" : {
					"zui5_epm_sample.Product/Category" : {
						"@com.sap.vocabularies.Common.v1.ValueList#foo" : {
							"CollectionPath" : "VH_CategorySet",
							"SearchSupported" : true
						},
						// Note: SearchSupported === true is equivalent to FixedValues === false
						// We do not accept both at once, even if they are consistent
						"@com.sap.vocabularies.Common.v1.ValueListWithFixedValues" : false
					}
				},
				"zui5_epm_sample.Container" : {
					"ProductList" : {
						"$kind" : "EntitySet",
						"$Type" : "zui5_epm_sample.Product"
					}
				}
			},
			sPropertyPath = "/ProductList('HT-1000')/Category";

		oMetaModelMock.expects("fetchEntityContainer").atLeast(1)
			.returns(SyncPromise.resolve(oMetadata));

		// code under test
		return oModel.getMetaModel().requestValueListInfo(sPropertyPath).then(function () {
			assert.ok(false);
		}, function (oError) {
			assert.strictEqual(oError.message, "Must not set 'SearchSupported' in annotation "
				+ "'com.sap.vocabularies.Common.v1.ValueList' and annotation "
				+ "'com.sap.vocabularies.Common.v1.ValueListWithFixedValues'");
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchModule: synchronously", function (assert) {
		var vModule = {};

		this.mock(sap.ui).expects("require")
			.withExactArgs("sap/ui/model/odata/type/Int")
			.returns(vModule);  // requested module already loaded

		// code under test
		assert.strictEqual(this.oMetaModel.fetchModule("sap.ui.model.odata.type.Int").getResult(),
			vModule);
	});

	//*********************************************************************************************
	QUnit.test("fetchModule, asynchronous", function (assert) {
		var vModule = {},
			sModuleName = "sap/ui/model/odata/type/Int64",
			oSapUiMock = this.mock(sap.ui);

		oSapUiMock.expects("require")
			.withExactArgs(sModuleName)
			.returns(undefined); // requested module not yet loaded
		oSapUiMock.expects("require")
			.withExactArgs([sModuleName], sinon.match.func)
			.callsArgWithAsync(1, vModule);

		// code under test
		return this.oMetaModel.fetchModule("sap.ui.model.odata.type.Int64")
			.then(function (oResult) {
				assert.strictEqual(oResult, vModule);
		});
	});

	//*********************************************************************************************
	QUnit.test("fetchData", function (assert) {
		var oMetaData = {
				"some.schema." : {
					"$kind" : "Schema"
				}
			};

		this.mock(this.oMetaModel).expects("fetchEntityContainer")
			.withExactArgs()
			.returns(Promise.resolve(oMetaData));

		// code under test
		return this.oMetaModel.fetchData().then(function (oResult) {
			assert.deepEqual(oResult, oMetaData);

			delete oResult["some.schema."].$kind;
			assert.strictEqual(oMetaData["some.schema."].$kind, "Schema", "original is unchanged");
		});
	});

	//*********************************************************************************************
	QUnit.test("getData, requestData", function (assert) {
		return checkGetAndRequest(this, assert, "fetchData");
	});

	//*********************************************************************************************
	if (TestUtils.isRealOData()) {

		//*****************************************************************************************
		QUnit.test("getValueListType, requestValueListInfo: realOData", function (assert) {
			var sPath = new URI(TestUtils.proxy(sSampleServiceUrl))
					.absoluteTo(window.location.pathname).toString(),
				oModel = new ODataModel({
					serviceUrl : sPath,
					synchronizationMode : "None"
				}),
				oMetaModel = oModel.getMetaModel(),
				sPropertyPath = "/ProductList('HT-1000')/Category";

			return oMetaModel.requestObject("/ProductList/").then(function () {
				assert.strictEqual(oMetaModel.getValueListType(
						"/com.sap.gateway.default.zui5_epm_sample.v0002.Contact/Sex"),
					ValueListType.Fixed);
				assert.strictEqual(oMetaModel.getValueListType(sPropertyPath),
					ValueListType.Standard);
				return oMetaModel.requestValueListInfo(sPropertyPath).then(function (oResult) {
					var oValueListInfo = oResult[""];
					assert.strictEqual(oValueListInfo.CollectionPath, "H_EPM_PD_CATS_SH_Set");
				});
			});
		});

		//*****************************************************************************************
		QUnit.test("requestValueListInfo: same model w/o reference, realOData", function (assert) {
			var oModel = new ODataModel({
					serviceUrl : TestUtils.proxy(sSampleServiceUrl),
					synchronizationMode : "None"
				}),
				oMetaModel = oModel.getMetaModel(),
				sPropertyPath = "/ProductList/0/CurrencyCode",
				oValueListMetaModel;

			return oMetaModel.requestObject("/ProductList/").then(function () {
				// value list in the data service
				assert.strictEqual(oMetaModel.getValueListType(sPropertyPath),
					ValueListType.Standard);
				return oMetaModel.requestValueListInfo(sPropertyPath);
			}).then(function (oValueListInfo) {
				var sPropertyPath2 = "/H_TCURC_SH_Set/1/WAERS";

				// value list in the value list service
				oValueListMetaModel = oValueListInfo[""].$model.getMetaModel();
				assert.strictEqual(oValueListMetaModel.getValueListType(sPropertyPath2),
					ValueListType.Standard);
				assert.strictEqual(oValueListInfo[""].CollectionPath, "H_TCURC_SH_Set");
				return oValueListMetaModel.requestValueListInfo(sPropertyPath2);
			}).then(function (oValueListInfo) {
				assert.strictEqual(oValueListInfo[""].$model.getMetaModel(), oValueListMetaModel);
				assert.strictEqual(oValueListInfo[""].CollectionPath, "TCURC_CT_Set");
			});
		});
	}
});
//TODO getContext vs. createBindingContext; map of "singletons" vs. memory leak