const { Command } = require("commander");
const { login, logout, whoami } = require("../commands/auth");
const {
  listProfiles, getProfile, searchProfiles, createProfile, exportProfiles,
} = require("../commands/profiles");

const program = new Command();

program
  .name("insighta")
  .description("Insighta Labs+ CLI — demographic intelligence at your fingertips")
  .version("1.0.0");

// ── Auth commands ──────────────────────────────────────────────────────────
program
  .command("login")
  .description("Log in via GitHub OAuth")
  .action(login);

program
  .command("logout")
  .description("Log out and clear stored credentials")
  .action(logout);

program
  .command("whoami")
  .description("Show the currently logged-in user")
  .action(whoami);

// ── Profiles commands ──────────────────────────────────────────────────────
const profiles = program.command("profiles").description("Manage profiles");

profiles
  .command("list")
  .description("List profiles with optional filters")
  .option("--gender <gender>", "Filter by gender (male/female)")
  .option("--country <code>", "Filter by country ID (e.g. NG)")
  .option("--age-group <group>", "Filter by age group")
  .option("--min-age <age>", "Minimum age")
  .option("--max-age <age>", "Maximum age")
  .option("--sort-by <field>", "Sort by: age, created_at, gender_probability")
  .option("--order <order>", "Sort order: asc or desc")
  .option("--page <page>", "Page number", "1")
  .option("--limit <limit>", "Results per page", "10")
  .action(listProfiles);

profiles
  .command("get <id>")
  .description("Get a single profile by ID")
  .action(getProfile);

profiles
  .command("search <query>")
  .description('Search profiles in plain English e.g. "young males from nigeria"')
  .option("--page <page>", "Page number", "1")
  .option("--limit <limit>", "Results per page", "10")
  .action(searchProfiles);

profiles
  .command("create")
  .description("Create a new profile (admin only)")
  .requiredOption("--name <name>", "Full name to classify")
  .action(createProfile);

profiles
  .command("export")
  .description("Export profiles to CSV")
  .option("--format <format>", "Export format (csv)", "csv")
  .option("--gender <gender>", "Filter by gender")
  .option("--country <code>", "Filter by country ID")
  .action(exportProfiles);

program.parse(process.argv);