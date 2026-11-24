import { siteConfig } from "../config";
import type I18nKey from "./i18nKey";
import { en } from "./languages/en";
import { es } from "./languages/es";
import { id } from "./languages/id";
import { ja } from "./languages/ja";
import { ko } from "./languages/ko";
import { th } from "./languages/th";
import { tr } from "./languages/tr";
import { vi } from "./languages/vi";
import { zh_CN } from "./languages/zh_CN";
import { zh_TW } from "./languages/zh_TW";

export type Translation = {
	[K in I18nKey]: string;
};

const defaultTranslation = en;

const map: { [key: string]: Translation } = {
	es: es,
	en: en,
	en_us: en,
	en_gb: en,
	en_au: en,
	zh_cn: zh_CN,
	zh_tw: zh_TW,
	ja: ja,
	ja_jp: ja,
	ko: ko,
	ko_kr: ko,
	th: th,
	th_th: th,
	vi: vi,
	vi_vn: vi,
	id: id,
	tr: tr,
	tr_tr: tr,
};

export function getTranslation(lang: string): Translation {
	return map[lang.toLowerCase()] || defaultTranslation;
}

export function isEnglish(lang?: string): boolean {
	return (lang || "").toLowerCase().startsWith("en");
}

export function normalizeLang(lang?: string): "zh_CN" | "en" {
	return isEnglish(lang) ? "en" : "zh_CN";
}

export function getLangFromPathname(pathname: string): "zh_CN" | "en" {
	const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
	const stripped =
		base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	const normalized = stripped.startsWith("/") ? stripped : `/${stripped}`;
	return normalized === "/en" || normalized.startsWith("/en/") ? "en" : "zh_CN";
}

export function i18n(key: I18nKey, lang?: string): string {
	const targetLang = lang || siteConfig.lang || "en";
	return getTranslation(targetLang)[key];
}
