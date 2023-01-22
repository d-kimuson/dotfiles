SHELL=/bin/zsh
target := ".zshrc" ".commandsrc" ".localrc" ".gitconfig" ".czrc" ".gitconfig-mfac" ".gitignore_global"

setup:
	make relink

pull:
	git pull origin master

relink:
	make unlink
	make link

link:
	@./scripts/link.sh $(target)

unlink:
	@./scripts/unlink.sh $(target)
