import * as fs from "fs";
import {Snowflake} from "discord.js";

interface UserSetting {
    roles: "all" | "highest",
    cult: number | null
}

const settings: { season: number, seasonNames: string[], users: { [key: Snowflake]: UserSetting }, multiplier: { amount: number, end: number | null, description: string } | null, cult_message: Snowflake | null, cults: { [key: number]: { name: string, role: Snowflake | null, icon: string, description: string, open: boolean, legacy: boolean, emoji: string } } } = require("./settings.json");
const defaultUserSetting: UserSetting = {roles: "all", cult: null};

function updateSettings() {
    fs.writeFileSync("./settings.json", JSON.stringify(settings, null, 4));
}

function getSeason() {
    return settings.season;
}

function getSeasonNameInternal(season: number) {
    return settings.seasonNames[season] || "Unknown Season";
}

function endSeason(name: string) {
    settings.season++;
    settings.seasonNames.push(name);
    updateSettings();
}

function getUserSetting(user: Snowflake) {
    const stg: UserSetting = settings.users[user] || {...defaultUserSetting};
    if (stg.cult === undefined) stg.cult = null;
    return stg;
}

function setUserSetting(user: Snowflake, setting: UserSetting) {
    settings.users[user] = setting;
    updateSettings();
}

function getMultiplier(): { amount: number, end: number | null, description: string } | null {
    if (settings.multiplier === null) return null;
    if (settings.multiplier.end !== null && settings.multiplier.end < Date.now()) {
        settings.multiplier = null;
        updateSettings();
    }
    return settings.multiplier;
}

function setMultiplier(amount: number, end: number | null, description: string) {
    settings.multiplier = {amount, end, description};
    updateSettings();
}

function clearMultiplier() {
    settings.multiplier = null;
    updateSettings();
}

function getCultData(cult: number) {
    return settings.cults[cult];
}

function getFullName(cult: number): string {
    return settings.cults[cult].emoji + " " + settings.cults[cult].name;
}

function addCult(name: string, description: string, icon: string, emoji: Snowflake) {
    settings.cults[Math.max(...Object.keys(settings.cults).map(k => parseInt(k)), 0) + 1] = {name, role: null, icon, description, open: true, legacy: false, emoji};
    updateSettings();
}

function updateCult(cult: number, name: string, description: string, icon: string, role: Snowflake | null, open: boolean, emoji: Snowflake) {
    settings.cults[cult] = {name, description, icon, role, open, legacy: false, emoji};
    updateSettings();
}

function removeCult(cult: number) {
    settings.cults[cult].legacy = true;
    for (const user in settings.users) {
        if (settings.users[user].cult === cult) {
            settings.users[user].cult = null;
        }
    }
    updateSettings();
}

function getAllCults() {
    let cults: { id: number, name: string, description: string, open: boolean, legacy: boolean, emoji: Snowflake }[] = [];
    for (const cult in settings.cults) {
        cults.push({id: parseInt(cult), name: settings.cults[cult].name, description: settings.cults[cult].description, open: settings.cults[cult].open, legacy: settings.cults[cult].legacy, emoji: settings.cults[cult].emoji});
    }
    return cults;
}

function getCults() {
    return getAllCults().filter(c => !c.legacy);
}

function getCultMessage() {
    return settings.cult_message;
}

function setCultMessage(message: Snowflake) {
    settings.cult_message = message;
    updateSettings();
}

function getCultMembers(cult: number): number {
    return Object.values(settings.users).filter(u => u.cult === cult).length;
}

export {getSeason, endSeason, getSeasonNameInternal, getUserSetting, setUserSetting, getMultiplier, setMultiplier, clearMultiplier, getCultData, addCult, removeCult, getCults, updateCult, getCultMessage, setCultMessage, getCultMembers, getAllCults, getFullName};