exports.run = function() {
    var jsv_env = JSV.createEnvironment('json-schema-draft-03');
    test_file('examples/example-minimum.json', jsv_env);
    test_file('examples/example-simple.json', jsv_env);
    test_file('examples/example-full.json', jsv_env);
};

var test_file = function(json_path, jsv_env) {
    var json, parsed_json;
    json = fs.readFileSync(json_path);
    parsed_json = JSON.parse(json);
    report = jsv_env.validate(parsed_json, schema);
    if (report.errors.length > 0) {
      console.log("TESTING: ", json_path);
      console.log("ERRORS: ", report.errors);
    }
    assert.equal(report.errors.length, 0);
};