"use strict";

// Fix back button cache problem
window.onunload = function () { };

// Global variable, shared between modules
function playpen_text(playpen) {
    let code_block = playpen.querySelector("code");

    if (window.ace && code_block.classList.contains("editable")) {
        let editor = window.ace.edit(code_block);
        return editor.getValue();
    } else {
        return code_block.textContent;
    }
}

(function codeSnippets() {
    function fetch_with_timeout(url, options, timeout = 6000) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
        ]);
    }

    var playpens = Array.from(document.querySelectorAll(".playpen"));
    if (playpens.length > 0) {
        fetch_with_timeout("https://play.rust-lang.org/meta/crates", {
            headers: {
                'Content-Type': "application/json",
            },
            method: 'POST',
            mode: 'cors',
        })
        .then(response => response.json())
        .then(response => {
            // get list of crates available in the rust playground
            let playground_crates = response.crates.map(item => item["id"]);
            playpens.forEach(block => handle_crate_list_update(block, playground_crates));
        });
    }

    function handle_crate_list_update(playpen_block, playground_crates) {
        // update the play buttons after receiving the response
        update_play_button(playpen_block, playground_crates);

        // and install on change listener to dynamically update ACE editors
        if (window.ace) {
            let code_block = playpen_block.querySelector("code");
            if (code_block.classList.contains("editable")) {
                let editor = window.ace.edit(code_block);
                editor.addEventListener("change", function (e) {
                    update_play_button(playpen_block, playground_crates);
                });
                // add Ctrl-Enter command to execute rust code
                editor.commands.addCommand({
                    name: "run",
                    bindKey: {
                        win: "Ctrl-Enter",
                        mac: "Ctrl-Enter"
                    },
                    exec: _editor => run_rust_code(playpen_block)
                });
            }
        }
    }

    // updates the visibility of play button based on `no_run` class and
    // used crates vs ones available on http://play.rust-lang.org
    function update_play_button(pre_block, playground_crates) {
        var play_button = pre_block.querySelector(".play-button");

        // skip if code is `no_run`
        if (pre_block.querySelector('code').classList.contains("no_run")) {
            play_button.classList.add("hidden");
            return;
        }

        // get list of `extern crate`'s from snippet
        var txt = playpen_text(pre_block);
        var re = /extern\s+crate\s+([a-zA-Z_0-9]+)\s*;/g;
        var snippet_crates = [];
        var item;
        while (item = re.exec(txt)) {
            snippet_crates.push(item[1]);
        }

        // check if all used crates are available on play.rust-lang.org
        var all_available = snippet_crates.every(function (elem) {
            return playground_crates.indexOf(elem) > -1;
        });

        if (all_available) {
            play_button.classList.remove("hidden");
        } else {
            play_button.classList.add("hidden");
        }
    }

    function run_rust_code(code_block) {
        var result_block = code_block.querySelector(".result");
        if (!result_block) {
            result_block = document.createElement('code');
            result_block.className = 'result hljs language-bash';

            code_block.append(result_block);
        }

        let text = playpen_text(code_block);
        let classes = code_block.querySelector('code').classList;
        let has_2018 = classes.contains("edition2018");
        let edition = has_2018 ? "2018" : "2015";

        var params = {
            version: "stable",
            optimize: "0",
            code: text,
            edition: edition
        };

        if (text.indexOf("#![feature") !== -1) {
            params.version = "nightly";
        }

        result_block.innerText = "Running...";

        fetch_with_timeout("https://play.rust-lang.org/evaluate.json", {
            headers: {
                'Content-Type': "application/json",
            },
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(params)
        })
        .then(response => response.json())
        .then(response => result_block.innerText = response.result)
        .catch(error => result_block.innerText = "Playground Communication: " + error.message);
    }

    // Syntax highlighting Configuration
    hljs.configure({
        tabReplace: '    ', // 4 spaces
        languages: [],      // Languages used for auto-detection
    });

    if (window.ace) {
        // language-rust class needs to be removed for editable
        // blocks or highlightjs will capture events
        Array
            .from(document.querySelectorAll('code.editable'))
            .forEach(function (block) { block.classList.remove('language-rust'); });

        Array
            .from(document.querySelectorAll('code:not(.editable)'))
            .forEach(function (block) { hljs.highlightBlock(block); });
    } else {
        Array
            .from(document.querySelectorAll('code'))
            .forEach(function (block) { hljs.highlightBlock(block); });
    }

    // Adding the hljs class gives code blocks the color css
    // even if highlighting doesn't apply
    Array
        .from(document.querySelectorAll('code'))
        .forEach(function (block) { block.classList.add('hljs'); });

    Array.from(document.querySelectorAll("code.language-rust")).forEach(function (block) {

        var lines = Array.from(block.querySelectorAll('.boring'));
        // If no lines were hidden, return
        if (!lines.length) { return; }
        block.classList.add("hide-boring");

        var buttons = document.createElement('div');
        buttons.className = 'buttons';
        buttons.innerHTML = "<button class=\"fa fa-expand\" title=\"Show hidden lines\" aria-label=\"Show hidden lines\"></button>";

        // add expand button
        var pre_block = block.parentNode;
        pre_block.insertBefore(buttons, pre_block.firstChild);

        pre_block.querySelector('.buttons').addEventListener('click', function (e) {
            if (e.target.classList.contains('fa-expand')) {
                e.target.classList.remove('fa-expand');
                e.target.classList.add('fa-compress');
                e.target.title = 'Hide lines';
                e.target.setAttribute('aria-label', e.target.title);

                block.classList.remove('hide-boring');
            } else if (e.target.classList.contains('fa-compress')) {
                e.target.classList.remove('fa-compress');
                e.target.classList.add('fa-expand');
                e.target.title = 'Show hidden lines';
                e.target.setAttribute('aria-label', e.target.title);

                block.classList.add('hide-boring');
            }
        });
    });

    if (window.playpen_copyable) {
        Array.from(document.querySelectorAll('pre code')).forEach(function (block) {
            var pre_block = block.parentNode;
            if (!pre_block.classList.contains('playpen')) {
                var buttons = pre_block.querySelector(".buttons");
                if (!buttons) {
                    buttons = document.createElement('div');
                    buttons.className = 'buttons';
                    pre_block.insertBefore(buttons, pre_block.firstChild);
                }

                var clipButton = document.createElement('button');
                clipButton.className = 'fa fa-copy clip-button';
                clipButton.title = 'Copy to clipboard';
                clipButton.setAttribute('aria-label', clipButton.title);
                clipButton.innerHTML = '<i class=\"tooltiptext\"></i>';

                buttons.insertBefore(clipButton, buttons.firstChild);
            }
        });
    }

    // Process playpen code blocks
    Array.from(document.querySelectorAll(".playpen")).forEach(function (pre_block) {
        // Add play button
        var buttons = pre_block.querySelector(".buttons");
        if (!buttons) {
            buttons = document.createElement('div');
            buttons.className = 'buttons';
            pre_block.insertBefore(buttons, pre_block.firstChild);
        }

        var runCodeButton = document.createElement('button');
        runCodeButton.className = 'fa fa-play play-button';
        runCodeButton.hidden = true;
        runCodeButton.title = 'Run this code';
        runCodeButton.setAttribute('aria-label', runCodeButton.title);

        buttons.insertBefore(runCodeButton, buttons.firstChild);
        runCodeButton.addEventListener('click', function (e) {
            run_rust_code(pre_block);
        });

        if (window.playpen_copyable) {
            var copyCodeClipboardButton = document.createElement('button');
            copyCodeClipboardButton.className = 'fa fa-copy clip-button';
            copyCodeClipboardButton.innerHTML = '<i class="tooltiptext"></i>';
            copyCodeClipboardButton.title = 'Copy to clipboard';
            copyCodeClipboardButton.setAttribute('aria-label', copyCodeClipboardButton.title);

            buttons.insertBefore(copyCodeClipboardButton, buttons.firstChild);
        }

        let code_block = pre_block.querySelector("code");
        if (window.ace && code_block.classList.contains("editable")) {
            var undoChangesButton = document.createElement('button');
            undoChangesButton.className = 'fa fa-history reset-button';
            undoChangesButton.title = 'Undo changes';
            undoChangesButton.setAttribute('aria-label', undoChangesButton.title);

            buttons.insertBefore(undoChangesButton, buttons.firstChild);

            undoChangesButton.addEventListener('click', function () {
                let editor = window.ace.edit(code_block);
                editor.setValue(editor.originalCode);
                editor.clearSelection();
            });
        }
    });
})();

(function langs() {
    var langToggleButton = document.getElementById('lang-toggle');
    var langPopup = document.getElementById('lang-list');

    function showLangs() {
        langPopup.style.display = 'block';
        langToggleButton.setAttribute('aria-expanded', true);
    }

    function hideLangs() {
        langPopup.style.display = 'none';
        langToggleButton.setAttribute('aria-expanded', false);
    }

    langToggleButton.addEventListener('click', function () {
        if (langPopup.style.display === 'block') {
            hideLangs();
        } else {
            showLangs();
        }
    });

    langPopup.addEventListener('click', function (e) {
        var lang = e.target.id || e.target.parentElement.id;
    });

    langPopup.addEventListener('focusout', function(e) {
        // e.relatedTarget is null in Safari and Firefox on macOS (see workaround below)
        if (!!e.relatedTarget && !langToggleButton.contains(e.relatedTarget) && !langPopup.contains(e.relatedTarget)) {
            hideLangs();
        }
    });

    // Should not be needed, but it works around an issue on macOS & iOS: https://github.com/rust-lang/mdBook/issues/628
    document.addEventListener('click', function(e) {
        if (langPopup.style.display === 'block' && !langToggleButton.contains(e.target) && !langPopup.contains(e.target)) {
            hideLangs();
        }
    });

    var lang2name = { 'ab': 'Abkhazian', 'aa': 'Afar', 'af': 'Afrikaans', 'sq': 'Albanian', 'am': 'Amharic', 'ar': 'Arabic', 'hy': 'Armenian', 'as': 'Assamese', 'ay': 'Aymara', 'az': 'Azerbaijani', 'ba': 'Bashkir', 'eu': 'Basque', 'bn': 'Bengali, Bangla', 'dz': 'Bhutani', 'bh': 'Bihari', 'bi': 'Bislama', 'br': 'Breton', 'bg': 'Bulgarian', 'my': 'Burmese', 'be': 'Byelorussian', 'km': 'Cambodian', 'ca': 'Catalan', 'zh': 'Chinese', 'co': 'Corsican', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch', 'en': 'English', 'eo': 'Esperanto', 'et': 'Estonian', 'fo': 'Faeroese', 'fj': 'Fiji', 'fi': 'Finnish', 'fr': 'French', 'fy': 'Frisian', 'gd': 'Gaelic (Scots Gaelic)', 'gl': 'Galician', 'ka': 'Georgian', 'de': 'German', 'el': 'Greek', 'kl': 'Greenlandic', 'gn': 'Guarani', 'gu': 'Gujarati', 'ha': 'Hausa', 'iw': 'Hebrew', 'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 'in': 'Indonesian', 'ia': 'Interlingua', 'ie': 'Interlingue', 'ik': 'Inupiak', 'ga': 'Irish', 'it': 'Italian', 'ja': 'Japanese', 'jw': 'Javanese', 'kn': 'Kannada', 'ks': 'Kashmiri', 'kk': 'Kazakh', 'rw': 'Kinyarwanda', 'ky': 'Kirghiz', 'rn': 'Kirundi', 'ko': 'Korean', 'ku': 'Kurdish', 'lo': 'Laothian', 'la': 'Latin', 'lv': 'Latvian, Lettish', 'ln': 'Lingala', 'lt': 'Lithuanian', 'mk': 'Macedonian', 'mg': 'Malagasy', 'ms': 'Malay', 'ml': 'Malayalam', 'mt': 'Maltese', 'mi': 'Maori', 'mr': 'Marathi', 'mo': 'Moldavian', 'mn': 'Mongolian', 'na': 'Nauru', 'ne': 'Nepali', 'no': 'Norwegian', 'oc': 'Occitan', 'or': 'Oriya', 'om': 'Oromo, Afan', 'ps': 'Pashto, Pushto', 'fa': 'Persian', 'pl': 'Polish', 'pt': 'Portuguese', 'pa': 'Punjabi', 'qu': 'Quechua', 'rm': 'Rhaeto-Romance', 'ro': 'Romanian', 'ru': 'Russian', 'sm': 'Samoan', 'sg': 'Sangro', 'sa': 'Sanskrit', 'sr': 'Serbian', 'sh': 'Serbo-Croatian', 'st': 'Sesotho', 'tn': 'Setswana', 'sn': 'Shona', 'sd': 'Sindhi', 'si': 'Singhalese', 'ss': 'Siswati', 'sk': 'Slovak', 'sl': 'Slovenian', 'so': 'Somali', 'es': 'Spanish', 'su': 'Sudanese', 'sw': 'Swahili', 'sv': 'Swedish', 'tl': 'Tagalog', 'tg': 'Tajik', 'ta': 'Tamil', 'tt': 'Tatar', 'te': 'Tegulu', 'th': 'Thai', 'bo': 'Tibetan', 'ti': 'Tigrinya', 'to': 'Tonga', 'ts': 'Tsonga', 'tr': 'Turkish', 'tk': 'Turkmen', 'tw': 'Twi', 'uk': 'Ukrainian', 'ur': 'Urdu', 'uz': 'Uzbek', 'vi': 'Vietnamese', 'vo': 'Volapuk', 'cy': 'Welsh', 'wo': 'Wolof', 'xh': 'Xhosa', 'ji': 'Yiddish', 'yo': 'Yoruba', 'zu': 'Zulu', };
    var country2emoji = { 'ad': "\u{1f1e6}\u{1f1e9}", 'ae': "\u{1f1e6}\u{1f1ea}", 'af': "\u{1f1e6}\u{1f1eb}", 'ag': "\u{1f1e6}\u{1f1ec}", 'ai': "\u{1f1e6}\u{1f1ee}", 'al': "\u{1f1e6}\u{1f1f1}", 'am': "\u{1f1e6}\u{1f1f2}", 'ao': "\u{1f1e6}\u{1f1f4}", 'aq': "\u{1f1e6}\u{1f1f6}", 'ar': "\u{1f1e6}\u{1f1f7}", 'as': "\u{1f1e6}\u{1f1f8}", 'at': "\u{1f1e6}\u{1f1f9}", 'au': "\u{1f1e6}\u{1f1fa}", 'aw': "\u{1f1e6}\u{1f1fc}", 'ax': "\u{1f1e6}\u{1f1fd}", 'az': "\u{1f1e6}\u{1f1ff}", 'ba': "\u{1f1e7}\u{1f1e6}", 'bb': "\u{1f1e7}\u{1f1e7}", 'bd': "\u{1f1e7}\u{1f1e9}", 'be': "\u{1f1e7}\u{1f1ea}", 'bf': "\u{1f1e7}\u{1f1eb}", 'bg': "\u{1f1e7}\u{1f1ec}", 'bh': "\u{1f1e7}\u{1f1ed}", 'bi': "\u{1f1e7}\u{1f1ee}", 'bj': "\u{1f1e7}\u{1f1ef}", 'bl': "\u{1f1e7}\u{1f1f1}", 'bm': "\u{1f1e7}\u{1f1f2}", 'bn': "\u{1f1e7}\u{1f1f3}", 'bo': "\u{1f1e7}\u{1f1f4}", 'bq': "\u{1f1e7}\u{1f1f6}", 'br': "\u{1f1e7}\u{1f1f7}", 'bs': "\u{1f1e7}\u{1f1f8}", 'bt': "\u{1f1e7}\u{1f1f9}", 'bv': "\u{1f1e7}\u{1f1fb}", 'bw': "\u{1f1e7}\u{1f1fc}", 'by': "\u{1f1e7}\u{1f1fe}", 'bz': "\u{1f1e7}\u{1f1ff}", 'ca': "\u{1f1e8}\u{1f1e6}", 'cc': "\u{1f1e8}\u{1f1e8}", 'cd': "\u{1f1e8}\u{1f1e9}", 'cf': "\u{1f1e8}\u{1f1eb}", 'cg': "\u{1f1e8}\u{1f1ec}", 'ch': "\u{1f1e8}\u{1f1ed}", 'ci': "\u{1f1e8}\u{1f1ee}", 'ck': "\u{1f1e8}\u{1f1f0}", 'cl': "\u{1f1e8}\u{1f1f1}", 'cm': "\u{1f1e8}\u{1f1f2}", 'cn': "\u{1f1e8}\u{1f1f3}", 'co': "\u{1f1e8}\u{1f1f4}", 'cr': "\u{1f1e8}\u{1f1f7}", 'cu': "\u{1f1e8}\u{1f1fa}", 'cv': "\u{1f1e8}\u{1f1fb}", 'cw': "\u{1f1e8}\u{1f1fc}", 'cx': "\u{1f1e8}\u{1f1fd}", 'cy': "\u{1f1e8}\u{1f1fe}", 'cz': "\u{1f1e8}\u{1f1ff}", 'de': "\u{1f1e9}\u{1f1ea}", 'dj': "\u{1f1e9}\u{1f1ef}", 'dk': "\u{1f1e9}\u{1f1f0}", 'dm': "\u{1f1e9}\u{1f1f2}", 'do': "\u{1f1e9}\u{1f1f4}", 'dz': "\u{1f1e9}\u{1f1ff}", 'ec': "\u{1f1ea}\u{1f1e8}", 'ee': "\u{1f1ea}\u{1f1ea}", 'eg': "\u{1f1ea}\u{1f1ec}", 'eh': "\u{1f1ea}\u{1f1ed}", 'er': "\u{1f1ea}\u{1f1f7}", 'es': "\u{1f1ea}\u{1f1f8}", 'et': "\u{1f1ea}\u{1f1f9}", 'fi': "\u{1f1eb}\u{1f1ee}", 'fj': "\u{1f1eb}\u{1f1ef}", 'fk': "\u{1f1eb}\u{1f1f0}", 'fm': "\u{1f1eb}\u{1f1f2}", 'fo': "\u{1f1eb}\u{1f1f4}", 'fr': "\u{1f1eb}\u{1f1f7}", 'ga': "\u{1f1ec}\u{1f1e6}", 'gb': "\u{1f1ec}\u{1f1e7}", 'gd': "\u{1f1ec}\u{1f1e9}", 'ge': "\u{1f1ec}\u{1f1ea}", 'gf': "\u{1f1ec}\u{1f1eb}", 'gg': "\u{1f1ec}\u{1f1ec}", 'gh': "\u{1f1ec}\u{1f1ed}", 'gi': "\u{1f1ec}\u{1f1ee}", 'gl': "\u{1f1ec}\u{1f1f1}", 'gm': "\u{1f1ec}\u{1f1f2}", 'gn': "\u{1f1ec}\u{1f1f3}", 'gp': "\u{1f1ec}\u{1f1f5}", 'gq': "\u{1f1ec}\u{1f1f6}", 'gr': "\u{1f1ec}\u{1f1f7}", 'gs': "\u{1f1ec}\u{1f1f8}", 'gt': "\u{1f1ec}\u{1f1f9}", 'gu': "\u{1f1ec}\u{1f1fa}", 'gw': "\u{1f1ec}\u{1f1fc}", 'gy': "\u{1f1ec}\u{1f1fe}", 'hk': "\u{1f1ed}\u{1f1f0}", 'hm': "\u{1f1ed}\u{1f1f2}", 'hn': "\u{1f1ed}\u{1f1f3}", 'hr': "\u{1f1ed}\u{1f1f7}", 'ht': "\u{1f1ed}\u{1f1f9}", 'hu': "\u{1f1ed}\u{1f1fa}", 'id': "\u{1f1ee}\u{1f1e9}", 'ie': "\u{1f1ee}\u{1f1ea}", 'il': "\u{1f1ee}\u{1f1f1}", 'im': "\u{1f1ee}\u{1f1f2}", 'in': "\u{1f1ee}\u{1f1f3}", 'io': "\u{1f1ee}\u{1f1f4}", 'iq': "\u{1f1ee}\u{1f1f6}", 'ir': "\u{1f1ee}\u{1f1f7}", 'is': "\u{1f1ee}\u{1f1f8}", 'it': "\u{1f1ee}\u{1f1f9}", 'je': "\u{1f1ef}\u{1f1ea}", 'jm': "\u{1f1ef}\u{1f1f2}", 'jo': "\u{1f1ef}\u{1f1f4}", 'jp': "\u{1f1ef}\u{1f1f5}", 'ke': "\u{1f1f0}\u{1f1ea}", 'kg': "\u{1f1f0}\u{1f1ec}", 'kh': "\u{1f1f0}\u{1f1ed}", 'ki': "\u{1f1f0}\u{1f1ee}", 'km': "\u{1f1f0}\u{1f1f2}", 'kn': "\u{1f1f0}\u{1f1f3}", 'kp': "\u{1f1f0}\u{1f1f5}", 'kr': "\u{1f1f0}\u{1f1f7}", 'kw': "\u{1f1f0}\u{1f1fc}", 'ky': "\u{1f1f0}\u{1f1fe}", 'kz': "\u{1f1f0}\u{1f1ff}", 'la': "\u{1f1f1}\u{1f1e6}", 'lb': "\u{1f1f1}\u{1f1e7}", 'lc': "\u{1f1f1}\u{1f1e8}", 'li': "\u{1f1f1}\u{1f1ee}", 'lk': "\u{1f1f1}\u{1f1f0}", 'lr': "\u{1f1f1}\u{1f1f7}", 'ls': "\u{1f1f1}\u{1f1f8}", 'lt': "\u{1f1f1}\u{1f1f9}", 'lu': "\u{1f1f1}\u{1f1fa}", 'lv': "\u{1f1f1}\u{1f1fb}", 'ly': "\u{1f1f1}\u{1f1fe}", 'ma': "\u{1f1f2}\u{1f1e6}", 'mc': "\u{1f1f2}\u{1f1e8}", 'md': "\u{1f1f2}\u{1f1e9}", 'me': "\u{1f1f2}\u{1f1ea}", 'mf': "\u{1f1f2}\u{1f1eb}", 'mg': "\u{1f1f2}\u{1f1ec}", 'mh': "\u{1f1f2}\u{1f1ed}", 'mk': "\u{1f1f2}\u{1f1f0}", 'ml': "\u{1f1f2}\u{1f1f1}", 'mm': "\u{1f1f2}\u{1f1f2}", 'mn': "\u{1f1f2}\u{1f1f3}", 'mo': "\u{1f1f2}\u{1f1f4}", 'mp': "\u{1f1f2}\u{1f1f5}", 'mq': "\u{1f1f2}\u{1f1f6}", 'mr': "\u{1f1f2}\u{1f1f7}", 'ms': "\u{1f1f2}\u{1f1f8}", 'mt': "\u{1f1f2}\u{1f1f9}", 'mu': "\u{1f1f2}\u{1f1fa}", 'mv': "\u{1f1f2}\u{1f1fb}", 'mw': "\u{1f1f2}\u{1f1fc}", 'mx': "\u{1f1f2}\u{1f1fd}", 'my': "\u{1f1f2}\u{1f1fe}", 'mz': "\u{1f1f2}\u{1f1ff}", 'na': "\u{1f1f3}\u{1f1e6}", 'nc': "\u{1f1f3}\u{1f1e8}", 'ne': "\u{1f1f3}\u{1f1ea}", 'nf': "\u{1f1f3}\u{1f1eb}", 'ng': "\u{1f1f3}\u{1f1ec}", 'ni': "\u{1f1f3}\u{1f1ee}", 'nl': "\u{1f1f3}\u{1f1f1}", 'no': "\u{1f1f3}\u{1f1f4}", 'np': "\u{1f1f3}\u{1f1f5}", 'nr': "\u{1f1f3}\u{1f1f7}", 'nu': "\u{1f1f3}\u{1f1fa}", 'nz': "\u{1f1f3}\u{1f1ff}", 'om': "\u{1f1f4}\u{1f1f2}", 'pa': "\u{1f1f5}\u{1f1e6}", 'pe': "\u{1f1f5}\u{1f1ea}", 'pf': "\u{1f1f5}\u{1f1eb}", 'pg': "\u{1f1f5}\u{1f1ec}", 'ph': "\u{1f1f5}\u{1f1ed}", 'pk': "\u{1f1f5}\u{1f1f0}", 'pl': "\u{1f1f5}\u{1f1f1}", 'pm': "\u{1f1f5}\u{1f1f2}", 'pn': "\u{1f1f5}\u{1f1f3}", 'pr': "\u{1f1f5}\u{1f1f7}", 'ps': "\u{1f1f5}\u{1f1f8}", 'pt': "\u{1f1f5}\u{1f1f9}", 'pw': "\u{1f1f5}\u{1f1fc}", 'py': "\u{1f1f5}\u{1f1fe}", 'qa': "\u{1f1f6}\u{1f1e6}", 're': "\u{1f1f7}\u{1f1ea}", 'ro': "\u{1f1f7}\u{1f1f4}", 'rs': "\u{1f1f7}\u{1f1f8}", 'ru': "\u{1f1f7}\u{1f1fa}", 'rw': "\u{1f1f7}\u{1f1fc}", 'sa': "\u{1f1f8}\u{1f1e6}", 'sb': "\u{1f1f8}\u{1f1e7}", 'sc': "\u{1f1f8}\u{1f1e8}", 'sd': "\u{1f1f8}\u{1f1e9}", 'se': "\u{1f1f8}\u{1f1ea}", 'sg': "\u{1f1f8}\u{1f1ec}", 'sh': "\u{1f1f8}\u{1f1ed}", 'si': "\u{1f1f8}\u{1f1ee}", 'sj': "\u{1f1f8}\u{1f1ef}", 'sk': "\u{1f1f8}\u{1f1f0}", 'sl': "\u{1f1f8}\u{1f1f1}", 'sm': "\u{1f1f8}\u{1f1f2}", 'sn': "\u{1f1f8}\u{1f1f3}", 'so': "\u{1f1f8}\u{1f1f4}", 'sr': "\u{1f1f8}\u{1f1f7}", 'ss': "\u{1f1f8}\u{1f1f8}", 'st': "\u{1f1f8}\u{1f1f9}", 'sv': "\u{1f1f8}\u{1f1fb}", 'sx': "\u{1f1f8}\u{1f1fd}", 'sy': "\u{1f1f8}\u{1f1fe}", 'sz': "\u{1f1f8}\u{1f1ff}", 'tc': "\u{1f1f9}\u{1f1e8}", 'td': "\u{1f1f9}\u{1f1e9}", 'tf': "\u{1f1f9}\u{1f1eb}", 'tg': "\u{1f1f9}\u{1f1ec}", 'th': "\u{1f1f9}\u{1f1ed}", 'tj': "\u{1f1f9}\u{1f1ef}", 'tk': "\u{1f1f9}\u{1f1f0}", 'tl': "\u{1f1f9}\u{1f1f1}", 'tm': "\u{1f1f9}\u{1f1f2}", 'tn': "\u{1f1f9}\u{1f1f3}", 'to': "\u{1f1f9}\u{1f1f4}", 'tr': "\u{1f1f9}\u{1f1f7}", 'tt': "\u{1f1f9}\u{1f1f9}", 'tv': "\u{1f1f9}\u{1f1fb}", 'tw': "\u{1f1f9}\u{1f1fc}", 'tz': "\u{1f1f9}\u{1f1ff}", 'ua': "\u{1f1fa}\u{1f1e6}", 'ug': "\u{1f1fa}\u{1f1ec}", 'um': "\u{1f1fa}\u{1f1f2}", 'us': "\u{1f1fa}\u{1f1f8}", 'uy': "\u{1f1fa}\u{1f1fe}", 'uz': "\u{1f1fa}\u{1f1ff}", 'va': "\u{1f1fb}\u{1f1e6}", 'vc': "\u{1f1fb}\u{1f1e8}", 've': "\u{1f1fb}\u{1f1ea}", 'vg': "\u{1f1fb}\u{1f1ec}", 'vi': "\u{1f1fb}\u{1f1ee}", 'vn': "\u{1f1fb}\u{1f1f3}", 'vu': "\u{1f1fb}\u{1f1fa}", 'wf': "\u{1f1fc}\u{1f1eb}", 'ws': "\u{1f1fc}\u{1f1f8}", 'ye': "\u{1f1fe}\u{1f1ea}", 'yt': "\u{1f1fe}\u{1f1f9}", 'za': "\u{1f1ff}\u{1f1e6}", 'zm': "\u{1f1ff}\u{1f1f2}", 'zw': "\u{1f1ff}\u{1f1fc}", };
    var lang2country = { "aa": "dj", "af": "za", "ak": "gh", "ar": "sa", "sq": "al", "am": "et", "hy": "am", "az": "az", "bm": "ml", "be": "by", "bn": "bd", "bi": "vu", "bs": "ba", "bg": "bg", "my": "mm", "ca": "ad", "zh": "cn", "hr": "hr", "cs": "cz", "da": "dk", "dv": "mv", "nl": "nl", "dz": "bt", "en": "gb", "et": "ee", "fj": "fj", "fil": "ph", "fi": "fi", "fr": "fr", "gaa": "gh", "ka": "ge", "de": "de", "el": "gr", "gu": "in", "ht": "ht", "he": "il", "hi": "in", "ho": "pg", "hu": "hu", "is": "is", "ig": "ng", "id": "id", "ga": "ie", "it": "it", "ja": "jp", "kr": "ne", "kk": "kz", "km": "kh", "kmb": "ao", "rw": "rw", "kg": "cg", "ko": "kr", "kj": "ao", "ku": "iq", "ky": "kg", "lo": "la", "la": "va", "lv": "lv", "ln": "cg", "lt": "lt", "lu": "cd", "lb": "lu", "mk": "mk", "mg": "mg", "ms": "my", "mt": "mt", "mi": "nz", "mh": "mh", "mn": "mn", "mos": "bf", "ne": "np", "nd": "zw", "nso": "za", "no": "no", "nb": "no", "nn": "no", "ny": "mw", "pap": "aw", "ps": "af", "fa": "ir", "pl": "pl", "pt": "pt", "pa": "in", "qu": "wh", "ro": "ro", "rm": "ch", "rn": "bi", "ru": "ru", "sg": "cf", "sr": "rs", "srr": "sn", "sn": "zw", "si": "lk", "sk": "sk", "sl": "si", "so": "so", "snk": "sn", "nr": "za", "st": "ls", "es": "es", "ss": "sz", "sv": "se", "tl": "ph", "tg": "tj", "ta": "lk", "te": "in", "tet": "tl", "th": "th", "ti": "er", "tpi": "pg", "ts": "za", "tn": "bw", "tr": "tr", "tk": "tm", "uk": "ua", "umb": "ao", "ur": "pk", "uz": "uz", "ve": "za", "vi": "vn", "cy": "gb", "wo": "sn", "xh": "za", "zu": "za" };

    var langSelectors = document.getElementsByClassName('lang-selector');
    for (var si = 0; si < langSelectors.length; si++) {
      var selector = langSelectors[si];
      for (var ci = 0; ci < selector.classList.length; ci++) {
        var cls = selector.classList[ci];
        if (cls.substr(0, 8) == 'lang-is-') {
          var lang_id = cls.substr(8);
          if (lang_id in lang2name) {
            var emoji = country2emoji[lang2country[lang_id] || ''] || '';
            emoji = emoji == '' ? '' : (' ' + emoji);
            selector.innerHTML = emoji + lang2name[lang_id];
          }
        }
      }
    }
    var placeholders = document.getElementsByClassName('flag-placeholder');
    for (var pi = 0; pi < placeholders.length; pi++) {
      var placeholder = placeholders[pi];
      for (var ci = 0; ci < placeholder.classList.length; ci++) {
        var cls = placeholder.classList[ci];
        if (cls.substr(0, 8) == 'lang-is-') {
          var lang_id = cls.substr(8);
          console.log(lang_id);
          if (lang_id in lang2name) {
            var emoji = country2emoji[lang2country[lang_id] || ''] || '';
            emoji = emoji == '' ? '' : (' ' + emoji);
            placeholder.innerHTML = emoji;
          } else {
            placeholder.classList.add('fa-globe');
          }
        }
      }
    }
})();

(function themes() {
    var html = document.querySelector('html');
    var themeToggleButton = document.getElementById('theme-toggle');
    var themePopup = document.getElementById('theme-list');
    var themeColorMetaTag = document.querySelector('meta[name="theme-color"]');
    var stylesheets = {
        ayuHighlight: document.querySelector("[href$='ayu-highlight.css']"),
        tomorrowNight: document.querySelector("[href$='tomorrow-night.css']"),
        highlight: document.querySelector("[href$='highlight.css']"),
    };


    function showThemes() {
        themePopup.style.display = 'block';
        themeToggleButton.setAttribute('aria-expanded', true);
        themePopup.querySelector("button#" + document.body.className).focus();
    }

    function hideThemes() {
        themePopup.style.display = 'none';
        themeToggleButton.setAttribute('aria-expanded', false);
        themeToggleButton.focus();
    }

    function set_theme(theme, store = true) {
        let ace_theme;

        if (theme == 'coal' || theme == 'navy') {
            stylesheets.ayuHighlight.disabled = true;
            stylesheets.tomorrowNight.disabled = false;
            stylesheets.highlight.disabled = true;

            ace_theme = "ace/theme/tomorrow_night";
        } else if (theme == 'ayu') {
            stylesheets.ayuHighlight.disabled = false;
            stylesheets.tomorrowNight.disabled = true;
            stylesheets.highlight.disabled = true;
            ace_theme = "ace/theme/tomorrow_night";
        } else {
            stylesheets.ayuHighlight.disabled = true;
            stylesheets.tomorrowNight.disabled = true;
            stylesheets.highlight.disabled = false;
            ace_theme = "ace/theme/dawn";
        }

        setTimeout(function () {
            themeColorMetaTag.content = getComputedStyle(document.body).backgroundColor;
        }, 1);

        if (window.ace && window.editors) {
            window.editors.forEach(function (editor) {
                editor.setTheme(ace_theme);
            });
        }

        var previousTheme;
        try { previousTheme = localStorage.getItem('mdbook-theme'); } catch (e) { }
        if (previousTheme === null || previousTheme === undefined) { previousTheme = default_theme; }

        if (store) {
            try { localStorage.setItem('mdbook-theme', theme); } catch (e) { }
        }

        html.classList.remove(previousTheme);
        html.classList.add(theme);
    }

    // Set theme
    var theme;
    try { theme = localStorage.getItem('mdbook-theme'); } catch(e) { }
    if (theme === null || theme === undefined) { theme = default_theme; }

    set_theme(theme, false);

    themeToggleButton.addEventListener('click', function () {
        if (themePopup.style.display === 'block') {
            hideThemes();
        } else {
            showThemes();
        }
    });

    themePopup.addEventListener('click', function (e) {
        var theme = e.target.id || e.target.parentElement.id;
        set_theme(theme);
    });

    themePopup.addEventListener('focusout', function(e) {
        // e.relatedTarget is null in Safari and Firefox on macOS (see workaround below)
        if (!!e.relatedTarget && !themeToggleButton.contains(e.relatedTarget) && !themePopup.contains(e.relatedTarget)) {
            hideThemes();
        }
    });

    // Should not be needed, but it works around an issue on macOS & iOS: https://github.com/rust-lang/mdBook/issues/628
    document.addEventListener('click', function(e) {
        if (themePopup.style.display === 'block' && !themeToggleButton.contains(e.target) && !themePopup.contains(e.target)) {
            hideThemes();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) { return; }
        if (!themePopup.contains(e.target)) { return; }

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                hideThemes();
                break;
            case 'ArrowUp':
                e.preventDefault();
                var li = document.activeElement.parentElement;
                if (li && li.previousElementSibling) {
                    li.previousElementSibling.querySelector('button').focus();
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                var li = document.activeElement.parentElement;
                if (li && li.nextElementSibling) {
                    li.nextElementSibling.querySelector('button').focus();
                }
                break;
            case 'Home':
                e.preventDefault();
                themePopup.querySelector('li:first-child button').focus();
                break;
            case 'End':
                e.preventDefault();
                themePopup.querySelector('li:last-child button').focus();
                break;
        }
    });
})();

(function sidebar() {
    var html = document.querySelector("html");
    var sidebar = document.getElementById("sidebar");
    var sidebarScrollBox = document.querySelector(".sidebar-scrollbox");
    var sidebarLinks = document.querySelectorAll('#sidebar a');
    var sidebarToggleButton = document.getElementById("sidebar-toggle");
    var sidebarResizeHandle = document.getElementById("sidebar-resize-handle");
    var firstContact = null;

    function showSidebar() {
        html.classList.remove('sidebar-hidden')
        html.classList.add('sidebar-visible');
        Array.from(sidebarLinks).forEach(function (link) {
            link.setAttribute('tabIndex', 0);
        });
        sidebarToggleButton.setAttribute('aria-expanded', true);
        sidebar.setAttribute('aria-hidden', false);
        try { localStorage.setItem('mdbook-sidebar', 'visible'); } catch (e) { }
    }


    var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');

    function toggleSection(ev) {
        ev.currentTarget.parentElement.classList.toggle('expanded');
    }

    Array.from(sidebarAnchorToggles).forEach(function (el) {
        el.addEventListener('click', toggleSection);
    });

    function hideSidebar() {
        html.classList.remove('sidebar-visible')
        html.classList.add('sidebar-hidden');
        Array.from(sidebarLinks).forEach(function (link) {
            link.setAttribute('tabIndex', -1);
        });
        sidebarToggleButton.setAttribute('aria-expanded', false);
        sidebar.setAttribute('aria-hidden', true);
        try { localStorage.setItem('mdbook-sidebar', 'hidden'); } catch (e) { }
    }

    // Toggle sidebar
    sidebarToggleButton.addEventListener('click', function sidebarToggle() {
        if (html.classList.contains("sidebar-hidden")) {
            showSidebar();
        } else if (html.classList.contains("sidebar-visible")) {
            hideSidebar();
        } else {
            if (getComputedStyle(sidebar)['transform'] === 'none') {
                hideSidebar();
            } else {
                showSidebar();
            }
        }
    });

    sidebarResizeHandle.addEventListener('mousedown', initResize, false);

    function initResize(e) {
        window.addEventListener('mousemove', resize, false);
        window.addEventListener('mouseup', stopResize, false);
        html.classList.add('sidebar-resizing');
    }
    function resize(e) {
        document.documentElement.style.setProperty('--sidebar-width', (e.clientX - sidebar.offsetLeft) + 'px');
    }
    //on mouseup remove windows functions mousemove & mouseup
    function stopResize(e) {
        html.classList.remove('sidebar-resizing');
        window.removeEventListener('mousemove', resize, false);
        window.removeEventListener('mouseup', stopResize, false);
    }

    document.addEventListener('touchstart', function (e) {
        firstContact = {
            x: e.touches[0].clientX,
            time: Date.now()
        };
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (!firstContact)
            return;

        var curX = e.touches[0].clientX;
        var xDiff = curX - firstContact.x,
            tDiff = Date.now() - firstContact.time;

        if (tDiff < 250 && Math.abs(xDiff) >= 150) {
            if (xDiff >= 0 && firstContact.x < Math.min(document.body.clientWidth * 0.25, 300))
                showSidebar();
            else if (xDiff < 0 && curX < 300)
                hideSidebar();

            firstContact = null;
        }
    }, { passive: true });

    // Scroll sidebar to current active section
    var activeSection = document.getElementById("sidebar").querySelector(".active");
    if (activeSection) {
        sidebarScrollBox.scrollTop = activeSection.offsetTop;
    }
})();

(function chapterNavigation() {
    document.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) { return; }
        if (window.search && window.search.hasFocus()) { return; }

        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                var nextButton = document.querySelector('.nav-chapters.next');
                if (nextButton) {
                    window.location.href = nextButton.href;
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                var previousButton = document.querySelector('.nav-chapters.previous');
                if (previousButton) {
                    window.location.href = previousButton.href;
                }
                break;
        }
    });
})();

(function clipboard() {
    var clipButtons = document.querySelectorAll('.clip-button');

    function hideTooltip(elem) {
        elem.firstChild.innerText = "";
        elem.className = 'fa fa-copy clip-button';
    }

    function showTooltip(elem, msg) {
        elem.firstChild.innerText = msg;
        elem.className = 'fa fa-copy tooltipped';
    }

    var clipboardSnippets = new ClipboardJS('.clip-button', {
        text: function (trigger) {
            hideTooltip(trigger);
            let playpen = trigger.closest("pre");
            return playpen_text(playpen);
        }
    });

    Array.from(clipButtons).forEach(function (clipButton) {
        clipButton.addEventListener('mouseout', function (e) {
            hideTooltip(e.currentTarget);
        });
    });

    clipboardSnippets.on('success', function (e) {
        e.clearSelection();
        showTooltip(e.trigger, "Copied!");
    });

    clipboardSnippets.on('error', function (e) {
        showTooltip(e.trigger, "Clipboard error!");
    });
})();

(function scrollToTop () {
    var menuTitle = document.querySelector('.menu-title');

    menuTitle.addEventListener('click', function () {
        document.scrollingElement.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

(function autoHideMenu() {
    var menu = document.getElementById('menu-bar');

    var previousScrollTop = document.scrollingElement.scrollTop;

    document.addEventListener('scroll', function () {
        if (menu.classList.contains('folded') && document.scrollingElement.scrollTop < previousScrollTop) {
            menu.classList.remove('folded');
        } else if (!menu.classList.contains('folded') && document.scrollingElement.scrollTop > previousScrollTop) {
            menu.classList.add('folded');
        }

        if (!menu.classList.contains('bordered') && document.scrollingElement.scrollTop > 0) {
            menu.classList.add('bordered');
        }

        if (menu.classList.contains('bordered') && document.scrollingElement.scrollTop === 0) {
            menu.classList.remove('bordered');
        }

        previousScrollTop = Math.max(document.scrollingElement.scrollTop, 0);
    }, { passive: true });
})();
