<script lang="ts">
import { isEnglish } from "@i18n/translation";
import Icon from "@iconify/svelte";

let { lang = "zh_CN" }: { lang?: string } = $props();

const currentLang: "zh_CN" | "en" = isEnglish(lang) ? "en" : "zh_CN";

function switchLanguage(targetLang: "zh_CN" | "en") {
	if (targetLang === currentLang) {
		hidePanel();
		return;
	}
	try {
		localStorage.setItem("user-lang", targetLang);
	} catch (_err) {
		// ignore storage errors
	}
	const path = window.location.pathname;
	let relative = path.startsWith("/") ? path : `/${path}`;
	if (relative === "/en" || relative === "/en/") {
		relative = "/";
	} else if (relative.startsWith("/en/")) {
		relative = relative.slice(3);
	}
	const nextPath =
		targetLang === "en"
			? `/en${relative === "/" ? "/" : relative}`
			: relative;
	window.location.href =
		nextPath + window.location.search + window.location.hash;
}

function toggleLanguage() {
	switchLanguage(currentLang === "en" ? "zh_CN" : "en");
}

function showPanel() {
	const panel = document.querySelector("#lang-panel");
	panel?.classList.remove("float-panel-closed");
}

function hidePanel() {
	const panel = document.querySelector("#lang-panel");
	panel?.classList.add("float-panel-closed");
}
</script>

<div class="relative z-50" role="menu" tabindex="-1" onmouseleave={hidePanel}>
    <button
        aria-label={currentLang === "en" ? "Switch Language" : "切换语言"}
        role="menuitem"
        class="relative btn-plain scale-animation rounded-lg h-11 w-11 active:scale-90"
        id="lang-switch"
        onclick={toggleLanguage}
        onmouseenter={showPanel}
    >
        <Icon icon="material-symbols:translate-rounded" class="text-[1.25rem]"></Icon>
    </button>

    <div id="lang-panel" class="hidden lg:block absolute transition float-panel-closed top-11 -right-2 pt-5">
        <div class="card-base float-panel p-2">
            <button
                class="flex transition whitespace-nowrap items-center !justify-start w-full btn-plain scale-animation rounded-lg h-9 px-3 font-medium active:scale-95 mb-0.5"
                class:current-theme-btn={currentLang === "zh_CN"}
                onclick={() => switchLanguage("zh_CN")}
            >
                简体中文
            </button>
            <button
                class="flex transition whitespace-nowrap items-center !justify-start w-full btn-plain scale-animation rounded-lg h-9 px-3 font-medium active:scale-95"
                class:current-theme-btn={currentLang === "en"}
                onclick={() => switchLanguage("en")}
            >
                English
            </button>
        </div>
    </div>
</div>
