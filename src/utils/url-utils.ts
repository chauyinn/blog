import I18nKey from "@i18n/i18nKey";
import { i18n, isEnglish } from "@i18n/translation";

export function pathsEqual(path1: string, path2: string) {
	const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
	const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
	return normalizedPath1 === normalizedPath2;
}

export function isHomePath(pathname: string): boolean {
	return pathsEqual(pathname, url("/")) || pathsEqual(pathname, url("/en/"));
}

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}

export function getCanonicalSlug(slug: string): string {
	return slug.replace(/^en\//, "").replace(/\/en$/, "");
}

export function localizePath(path: string, lang?: string): string {
	const normalized = path.startsWith("/") ? path : `/${path}`;
	if (isEnglish(lang)) {
		if (normalized === "/en" || normalized.startsWith("/en/")) {
			return normalized;
		}
		return joinUrl("/en", normalized);
	}
	return normalized;
}

export function localizeUrl(path: string, lang?: string): string {
	return url(localizePath(path, lang));
}

export function getSwitchLangUrl(
	pathname: string,
	targetLang: "zh_CN" | "en",
): string {
	const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
	let relative =
		base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	if (!relative.startsWith("/")) {
		relative = `/${relative}`;
	}
	if (relative === "/en" || relative === "/en/") {
		relative = "/";
	} else if (relative.startsWith("/en/")) {
		relative = relative.slice(3);
	}
	return localizeUrl(relative, targetLang);
}

export function getPostUrlBySlug(slug: string, lang?: string): string {
	return localizeUrl(`/posts/${getCanonicalSlug(slug)}/`, lang);
}

export function getTagUrl(tag: string, lang?: string): string {
	if (!tag) return localizeUrl("/archive/", lang);
	return localizeUrl(`/archive/?tag=${encodeURIComponent(tag.trim())}`, lang);
}

export function getCategoryUrl(category: string | null, lang?: string): string {
	if (
		!category ||
		category.trim() === "" ||
		category.trim().toLowerCase() ===
			i18n(I18nKey.uncategorized, lang).toLowerCase() ||
		category.trim().toLowerCase() === i18n(I18nKey.uncategorized).toLowerCase()
	)
		return localizeUrl("/archive/?uncategorized=true", lang);
	return localizeUrl(
		`/archive/?category=${encodeURIComponent(category.trim())}`,
		lang,
	);
}

export function getDir(path: string): string {
	const lastSlashIndex = path.lastIndexOf("/");
	if (lastSlashIndex < 0) {
		return "/";
	}
	return path.substring(0, lastSlashIndex + 1);
}

export function url(path: string) {
	return joinUrl("", import.meta.env.BASE_URL, path);
}
