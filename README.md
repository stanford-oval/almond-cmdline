# Almond

## End User Programmable Virtual Assistants

This repository contains the command line version of Almond, the end user programmable
assistant.

It is a full featured version, although it is mainly useful for development
and testing.

Almond is part of Open Thing Platform, a research project led by
prof. Monica Lam, from Stanford University.  You can find more
information at <https://thingpedia.stanford.edu/about>.

## Installing from the node package manager

```
npm install -g almond-cmdline
```

You can then run it with `almond` from the command line.

## Installing from source

The code depends on nodejs (>= 6.10), cvc4 (any version, although >= 1.5 is recommended).
Acquire the dependencies with:

```
git submodule update --init --recursive
```

Then you can install the dependencies with a standard `npm install`, or with `yarn install`.

**NOTE**: npm >= 5 is known NOT to work. For best results, use the npm that came with node 6.10 LTS,
or use yarn.

## Usage

Start Almond with `node ./main.js`

Follow the instructions to complete set up.
You can then type a sentence to instruct your virtual assistant.

Special commands are available using `\`. For the full list, use `\?`.
To quit, use `\q` or Ctrl-D (EOF).

### Setting up OAuth-based devices

To set up a device that uses OAuth, say

```
\d start-oauth <kind>
```

where `<kind>` is the identifier of the device you want, e.g. `\d start-oauth com.twitter`.

Copy the resulting URL in your browser and authenticate. The browser will redirect you
to a broken page under `http://127.0.0.1:3000`. Copy that and type:

```
\d complete-oauth <url>
```

### Enabling developer mode

If you're a Thingpedia developer using Command Line Almond for testing, you can
enable developer mode with the following commands:

```
\= developer-key "<your Thingpedia developer key>"
\= developer-dir "<absolute path to a directory containing your Thingpedia devices>"
```

Note that quotes are significant, so the commands look like:

```
\= developer-key "123456789...ABCDEF"
\= developer-dir "/home/bob/Projects/thingpedia-devices"
```

If, say, inside the "thingpedia-devices" directory is a subdirectory called `com.foo`
containing a `manifest.tt` file, that device will be loaded from the local path instead
of Thingpedia.

If you don't specify a `developer-dir` but you specify a `developer-key`, Almond
will access unapproved devices from your account, and download them automatically.

## Troubleshooting

### My devices don't see the latest updates

Almond uses a cached version of any Thingpedia device, which is periodically updated.
You can force an update with:

```
\d update <device-id>
```

(e.g. `\d update com.foo`).

You can also remove the cache directory entirely with:
```
rm -fr ~/.cache/almond-cmdline
```
At the next restart, Almond will download the code again from Thingpedia.
