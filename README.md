---
layout: default
title: JekyllBook
lang-ref: home
---

JekyllBook is a Jekyll theme based on the awesome theme of the Rust book built by [mdbook](https://github.com/rust-lang/mdBook).
If you're reading the README.md on Github, [click here](https://ebetica.github.io/jekyllbook/) to visit the rendered version.

![]({{ site.baseurl }}/static/preview.png)

## Usage

JekyllBook is built on top of jekyll. Simply run
```
gem install jekyll
```
to install jekyll, and serve it in the root directory of this repository with
```
jekyll -s --trace --baseurl ''
```

The table of contents / sidebar is located in the `_config.yml`.
Simply set up your config in this format:

```
chapters:
  - path: chapters/01.md
    sections:
      - path: chapters/01-1.md
      - path: chapters/01-2.md
  - path: chapters/02.md
```

Then, each of your chapters / sections should be prefaced with the Jekyll header:
```
---
layout: default
title: Name Of Chapter
---
```

[Katex](https://katex.org/) is supported out of the box, so you can write equations easily with

$$
\begin{aligned}
i \hbar \frac{\partial}{\partial t}\Psi(\mathbf{r},t) = \hat H \Psi(\mathbf{r},t)
\end{aligned}
$$

## Author

**Zeming Lin**
- <https://github.com/ebetica>
- <https://twitter.com/ebetica>


## License

Open sourced under the [MIT license](LICENSE.md).

<3
