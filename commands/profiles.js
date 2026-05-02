const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const Table = require("cli-table3");
const ora = require("ora");
const { getClient } = require("../utils/apiClient");

// ── List profiles ──────────────────────────────────────────────────────────
const listProfiles = async (options) => {
  const spinner = ora("Fetching profiles...").start();
  try {
    const client = getClient();
    const params = {};
    if (options.gender)    params.gender    = options.gender;
    if (options.country)   params.country_id = options.country;
    if (options.ageGroup)  params.age_group  = options.ageGroup;
    if (options.minAge)    params.min_age    = options.minAge;
    if (options.maxAge)    params.max_age    = options.maxAge;
    if (options.sortBy)    params.sort_by    = options.sortBy;
    if (options.order)     params.order      = options.order;
    if (options.page)      params.page       = options.page;
    if (options.limit)     params.limit      = options.limit;

    const res = await client.get("/api/profiles", { params });
    spinner.stop();

    const { data, total, page, limit, total_pages } = res.data;

    console.log(chalk.cyan(`\nProfiles — Page ${page}/${total_pages} (${total} total)\n`));

    const table = new Table({
      head: [
        chalk.white("Name"), chalk.white("Gender"), chalk.white("Age"),
        chalk.white("Age Group"), chalk.white("Country"), chalk.white("ID"),
      ],
      colWidths: [25, 10, 6, 12, 10, 38],
    });

    for (const p of data) {
      table.push([p.name, p.gender, p.age, p.age_group, p.country_id, p.id]);
    }
    console.log(table.toString());

    if (page < total_pages) {
      console.log(chalk.gray(`\nNext page: insighta profiles list --page ${page + 1}`));
    }
  } catch (err) {
    spinner.stop();
    console.error(chalk.red("Error:"), err.response?.data?.message || err.message);
  }
};

// ── Get single profile ─────────────────────────────────────────────────────
const getProfile = async (id) => {
  const spinner = ora("Fetching profile...").start();
  try {
    const client = getClient();
    const res = await client.get(`/api/profiles/${id}`);
    spinner.stop();

    const p = res.data.data;
    console.log(chalk.cyan("\nProfile Details\n"));
    const table = new Table({ style: { head: [] } });
    Object.entries(p).forEach(([key, val]) => table.push({ [chalk.white(key)]: String(val) }));
    console.log(table.toString());
  } catch (err) {
    spinner.stop();
    if (err.response?.status === 404) {
      console.error(chalk.red("Profile not found."));
    } else {
      console.error(chalk.red("Error:"), err.response?.data?.message || err.message);
    }
  }
};

// ── Search profiles ────────────────────────────────────────────────────────
const searchProfiles = async (query, options) => {
  const spinner = ora("Searching...").start();
  try {
    const client = getClient();
    const params = { q: query };
    if (options.page)  params.page  = options.page;
    if (options.limit) params.limit = options.limit;

    const res = await client.get("/api/profiles/search", { params });
    spinner.stop();

    const { data, total, page, total_pages } = res.data;
    console.log(chalk.cyan(`\nSearch Results for "${query}" — ${total} found (Page ${page}/${total_pages})\n`));

    const table = new Table({
      head: [chalk.white("Name"), chalk.white("Gender"), chalk.white("Age"), chalk.white("Country"), chalk.white("ID")],
      colWidths: [25, 10, 6, 10, 38],
    });
    for (const p of data) {
      table.push([p.name, p.gender, p.age, p.country_id, p.id]);
    }
    console.log(table.toString());
  } catch (err) {
    spinner.stop();
    console.error(chalk.red("Error:"), err.response?.data?.message || err.message);
  }
};

// ── Create profile ─────────────────────────────────────────────────────────
const createProfile = async (options) => {
  if (!options.name) {
    console.error(chalk.red("Error: --name is required"));
    return;
  }
  const spinner = ora(`Creating profile for "${options.name}"...`).start();
  try {
    const client = getClient();
    const res = await client.post("/api/profiles", { name: options.name });
    spinner.stop();

    if (res.data.message === "Profile already exists") {
      console.log(chalk.yellow("Profile already exists:"));
    } else {
      console.log(chalk.green("✓ Profile created:"));
    }

    const p = res.data.data;
    const table = new Table({ style: { head: [] } });
    Object.entries(p).forEach(([key, val]) => table.push({ [chalk.white(key)]: String(val) }));
    console.log(table.toString());
  } catch (err) {
    spinner.stop();
    if (err.response?.status === 403) {
      console.error(chalk.red("Error: Admin access required to create profiles."));
    } else {
      console.error(chalk.red("Error:"), err.response?.data?.message || err.message);
    }
  }
};

// ── Export profiles ────────────────────────────────────────────────────────
const exportProfiles = async (options) => {
  const spinner = ora("Exporting profiles...").start();
  try {
    const client = getClient();
    const params = { format: "csv" };
    if (options.gender)  params.gender    = options.gender;
    if (options.country) params.country_id = options.country;

    const res = await client.get("/api/profiles/export", { params, responseType: "text" });
    spinner.stop();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `profiles_${timestamp}.csv`;
    const outputPath = path.join(process.cwd(), filename);
    fs.writeFileSync(outputPath, res.data);
    console.log(chalk.green(`✓ Exported to ${outputPath}`));
  } catch (err) {
    spinner.stop();
    console.error(chalk.red("Error:"), err.response?.data?.message || err.message);
  }
};

module.exports = { listProfiles, getProfile, searchProfiles, createProfile, exportProfiles };