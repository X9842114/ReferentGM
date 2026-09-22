migrate(
  (app) => {
    const collection = new Collection({
      type: "base",
      name: "refgm_rows",
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
      fields: [
        { name: "table_name", type: "text", required: true, max: 120 },
        { name: "row_key", type: "text", required: true, max: 240 },
        { name: "payload", type: "json", required: true, maxSize: 8000000 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_refgm_rows_table_key ON refgm_rows (table_name, row_key)",
      ],
    });

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("refgm_rows");
    app.delete(collection);
  },
);
