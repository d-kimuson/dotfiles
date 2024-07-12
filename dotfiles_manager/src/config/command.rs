use crate::commands::structs::{AliasDeclaration, FunctionDeclaration};

pub fn get_aliases() -> Vec<AliasDeclaration> {
    vec![
        // regular
        AliasDeclaration {
            name: "l",
            definition: "exa",
        },
        AliasDeclaration {
            name: "tree",
            definition: "lsd --tree",
        },
        AliasDeclaration {
            name: "reload",
            definition: "exec $SHELL -l",
        },
        AliasDeclaration {
            name: "diffy",
            definition: "colordiff -y --left-column",
        },
        AliasDeclaration {
            name: "diffx",
            definition: "colordiff -u",
        },
        AliasDeclaration {
            name: "cda",
            definition: "cd ~/Apps",
        },
        AliasDeclaration {
            name: "cdp",
            definition: "cd ~/Playground",
        },
        AliasDeclaration {
            name: "myip",
            definition: "ifconfig | grep 192 | cut -f 2 -d ' '",
        },
        // docker
        AliasDeclaration {
            name: "d",
            definition: "docker",
        },
        AliasDeclaration {
            name: "dcmp",
            definition: "docker compose",
        },
        // git
        AliasDeclaration {
            name: "g",
            definition: "git",
        },
        // TODO: glog
        AliasDeclaration {
            name: "gpushf",
            definition: "git push origin HEAD --force-with-lease",
        },
        AliasDeclaration {
            name: "gunadd",
            definition: "git restore --staged",
        },
        AliasDeclaration {
            name: "guncom",
            definition: "git rm -rf --cached",
        },
        AliasDeclaration {
            name: "gpull",
            // git fetch && git merge --ff origin/$(git rev-parse --abbrev-ref HEAD)
            definition: "git pull origin HEAD",
        },
    ]
}

pub fn get_functions() -> Vec<FunctionDeclaration> {
    vec![
        FunctionDeclaration {
            name: "c",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required file path";
                return 1;
            fi

            bat --pager '' $1
            "#,
        },
        FunctionDeclaration {
            // rust の文脈から判定した OS を返すだけにしたい
            name: "get_os",
            definition: r#"
            if [ "$(uname)" = "Darwin" ]; then
              if [ "$(which arch)" = "arch not found" ]; then
                os="mac-intel"
              else
                os="mac-m1"
              fi
              elif [ "$(uname)" = "Linux" ]; then
              if [ -e /etc/debian_version ] || [ -e /etc/debian_release ]; then
                if [ -e /etc/lsb-release ]; then
                  os="ubuntu"
                else
                  os="debian"
                fi
                elif [ -e /etc/centos-release ]; then
                os="centos"
              else
                os="unknown-linux"
              fi
            else
              os="unknown"
            fi
  
            echo $os
            "#,
        },
        FunctionDeclaration {
            name: "kill-port",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required port number";
                return 1;
            fi

            lsof -i :$1 | awk -F " " '{ print $2 }' | grep -v "PID" | xargs kill -9
            "#,
        },
        // docker
        FunctionDeclaration {
            name: "install-compose",
            definition: r#"
            mkdir -p $DOCKER_CONFIG/cli-plugins
            curl -SL https://github.com/docker/compose/releases/download/v2.23.1/docker-compose-darwin-aarch64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
            chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
            "#,
        },
        FunctionDeclaration {
            name: "colima-start",
            definition: r#"
            colima start --cpu ${COLIMA_CPU:-6} --memory ${COLIMA_MEMORY:-12} --disk ${COLIMA_DISK:-120} \
            --arch aarch64 \
            --vm-type vz --vz-rosetta --mount-type virtiofs --mount-inotify\
            --mount $HOME/sms/:w\
            --mount $HOME/Apps/:w\
            --mount $HOME/Playground/:w
            "#,
        },
        FunctionDeclaration {
            name: "dkill_all",
            definition: r#"
            docker rm -f $(docker ps -aq)
            "#,
        },
        FunctionDeclaration {
            name: "dkill",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required container id or name";
                return 1;
            fi

            docker rm -f $1
            "#,
        },
        FunctionDeclaration {
            name: "dkilli_all",
            definition: r#"
            docker rmi $(docker images -aq)
            "#,
        },
        FunctionDeclaration {
            name: "dkilli",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required container id or name";
                return 1;
            fi

            docker rmi -f $1
            "#,
        },
        FunctionDeclaration {
            name: "dbash",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required container id or name";
                return 1;
            fi

            docker exec -it $1 bash
            "#,
        },
        FunctionDeclaration {
            name: "dsh",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required container id or name";
                return 1;
            fi

            docker exec -it $1 sh
            "#,
        },
        FunctionDeclaration {
            name: "dlog",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required container id or name";
                return 1;
            fi

            docker logs -f $1
            "#,
        },
        // git
        FunctionDeclaration {
            name: "gadd",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required file path";
                return 1;
            fi

            git add $1 && git status
            "#,
        },
        FunctionDeclaration {
            name: "gcd",
            definition: "cd $(git rev-parse --show-toplevel)",
        },
        FunctionDeclaration {
            name: "gpull",
            definition: "git fetch && git merge origin/$(git rev-parse --abbrev-ref HEAD)",
        },
        FunctionDeclaration {
            name: "gback",
            definition: r#"
            if [ -z "$1" ]; then
                echo "required commit hash";
                return 1;
            fi

            git reset --hard ${1};
            "#,
        },
        FunctionDeclaration {
            name: "gignore",
            definition: r#"
            # https://github.com/github/gitignore のテンプレートから gitignore を生成する
            echo "一覧: https://github.com/github/gitignore"
            
            INPUT='INIT'
            while [ "$INPUT" != "q" ]; do
              printf "Select Ignore Template(Press q to quit) >> "; read INPUT
              
              if [ "$INPUT" != "q" ]; then
                touch .gitignore
                curl "https://raw.githubusercontent.com/github/gitignore/master/"$INPUT".gitignore" | grep -v '404' >> .gitignore
                cat .gitignore
              fi
            done
            "#,
        },
        // 環境構築
        FunctionDeclaration {
            name: "setup_m1mac",
            definition: r#"
            brew update && brew upgrade

            # replace
            brew install coreutils diffutils ed findutils gawk gnu-sed gnu-tar grep gzip
            
            # utility
            brew install ag jq lv parallel pandoc sift wget wdiff xmlstarlet
            
            # to be latest
            brew install nano unzip

            # rust
            curl https://sh.rustup.rs -sSf | sh
            source $HOME/.cargo/env
            "#,
        },
        FunctionDeclaration {
            name: "setup_ubuntu",
            definition: r#"
            sudo apt update
            sudo apt upgrade -y

            sudo apt install zsh -y
            chsh -s $(which zsh)

            sudo apt install make gcc -y
            sudo apt install -y zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libffi-dev

            curl https://sh.rustup.rs -sSf | sh
            source $HOME/.cargo/env
            "#,
        },
    ]
}
