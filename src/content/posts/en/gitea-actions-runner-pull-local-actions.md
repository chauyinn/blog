---

title: How Gitea Actions Runner Pulls Local Actions with Sign-In Required
published: 2025-10-13
updated: 2025-10-13
description: 'How to let Gitea Actions Runner fetch local custom Actions in a private deployment when REQUIRE_SIGNIN_VIEW is enabled'
image: ''
tags: ["Gitea", "CI/CD", "Actions", "Runner"]
category: 'Automation'
draft: false
lang: 'en'
---

## Introduction

[Gitea](https://docs.gitea.com/) is an open-source, self-hosted Git service similar to GitHub and GitLab. It supports CI/CD workflows through Gitea Actions. In some environments, you may want your Gitea Actions Runner to fetch local custom Actions from your own Gitea instance rather than from GitHub—especially in regions with restricted or unstable access to GitHub.

## The Problem

In private deployments—especially those exposed to the public internet—if you set `REQUIRE_SIGNIN_VIEW = true` (forcing users to sign in before viewing any page or using the API), the Actions Runner will hit an authentication error and fail to pull local Actions due to insufficient permissions.

On the other hand, setting `REQUIRE_SIGNIN_VIEW = false` introduces a code-leakage risk, because anonymous visitors can browse your Gitea instance through the Explore page or public API endpoints.

This issue has been discussed upstream on GitHub without a built-in fix yet:

- [Runners cannot fetch custom actions](https://github.com/go-gitea/gitea/issues/27933)
- [Action runner should be run as a logined user when REQUIRE_SIGNIN_VIEW is true](https://github.com/go-gitea/gitea/issues/28813)

## Workarounds

### Disabling Only the Explore Page (Not Recommended)

In the [Gitea Configuration Cheat Sheet](https://docs.gitea.com/administration/config-cheat-sheet#service---explore-serviceexplore), `SERVICE.EXPLORE` has its own `REQUIRE_SIGNIN_VIEW` option. Unlike `[service] REQUIRE_SIGNIN_VIEW`, `SERVICE.EXPLORE.REQUIRE_SIGNIN_VIEW` only restricts the Explore UI without blocking API access:

```ini
[service]
REQUIRE_SIGNIN_VIEW = false

[service.explore]
REQUIRE_SIGNIN_VIEW = true
```

~~At first glance this looks safer than leaving everything public, though anyone who already knows a repository URL could still visit it.~~

:::caution
API testing confirms that with `[service] REQUIRE_SIGNIN_VIEW = false` and `[service.explore] REQUIRE_SIGNIN_VIEW = true`, anonymous requests to `your_gitea_host/api/v1/repos/search` still return the repository list. This does **not** prevent repository/code exposure—do not rely on this approach. Use the methods below instead.
:::

### Mounting Git Credentials into the Runner

You can supply Git credentials directly to the Runner's job containers so that the Runner authenticates when fetching local Actions, even with `REQUIRE_SIGNIN_VIEW = true`.

- Create a `.git-credentials` file:

```ini
http://{your_username}:{your_pat_token}@{your_gitea_host}:3000
```

- Create a `.gitconfig` file:

```ini
[credential]
    helper = store
    # Path inside the container, not on the host
    file = /root/.git-credentials
```

- In the Runner's [config.yaml](https://gitea.com/gitea/act_runner/src/branch/main/internal/pkg/config/config.example.yaml), configure `options` and `valid_volumes` under `container`:

```yaml
container:
  # Specifies the network to which the container will connect.
  # Could be host, bridge or the name of a custom network.
  # If it's empty, act_runner will create a network automatically.
  network: ""
  # Whether to use privileged mode or not when launching task containers (privileged mode is required for Docker-in-Docker).
  privileged: false
  # And other options to be used when the container is started (eg, --add-host=my.gitea.url:host-gateway).
  options: >-
    --mount type=bind,source=/path/to/.gitconfig,target=/root/.gitconfig,readonly
    --mount type=bind,source=/path/to/.git-credentials,target=/root/.git-credentials,readonly
  # The parent directory of a job's working directory.
  # NOTE: There is no need to add the first '/' of the path as act_runner will add it automatically.
  # If the path starts with '/', the '/' will be trimmed.
  # For example, if the parent directory is /path/to/my/dir, workdir_parent should be path/to/my/dir
  # If it's empty, /workspace will be used.
  workdir_parent:
  # Volumes (including bind mounts) can be mounted to containers. Glob syntax is supported, see https://github.com/gobwas/glob
  # You can specify multiple volumes. If the sequence is empty, no volumes can be mounted.
  # For example, if you only allow containers to mount the `data` volume and all the json files in `/src`, you should change the config to:
  # valid_volumes:
  #   - data
  #   - /src/*.json
  # If you want to allow any volume, please use the following configuration:
  # valid_volumes:
  #   - '**'
  valid_volumes:
    - "/path/to/.gitconfig"
    - "/path/to/.git-credentials"
  # overrides the docker client host with the specified one.
  # If it's empty, act_runner will find an available docker host automatically.
  # If it's "-", act_runner will find an available docker host automatically, but the docker host won't be mounted to the job containers and service containers.
  # If it's not empty or "-", the specified docker host will be used. An error will be returned if it doesn't work.
  docker_host: ""
  # Pull docker image(s) even if already present
  force_pull: true
  # Rebuild docker image(s) even if already present
  force_rebuild: false
```

`valid_volumes` whitelists the host paths the Runner is allowed to mount, and `--mount` in `options` bind-mounts `.gitconfig` and `.git-credentials` read-only into every job container so Git authenticates automatically when pulling local Actions.

### Alternative Approach

- Run a separate Gitea instance dedicated exclusively to hosting mirrored Actions repositories (with no private source code), allowing anonymous read access on that instance only.

**If you know a cleaner solution, feel free to reach out via email.**
