{
  lib,
  buildGoModule,
  fetchFromGitHub,
  makeWrapper,
  dolt,
  go_1_26,
  versionCheckHook,
}:

buildGoModule.override { go = go_1_26; } rec {
  pname = "beads";
  version = "0.61.0";

  src = fetchFromGitHub {
    owner = "steveyegge";
    repo = "beads";
    rev = "v${version}";
    hash = "sha256-3V0FrqJ/ajDlMyquAZo1jUmYXF4TneBoh3VTsjvwyq0=";
  };

  vendorHash = "sha256-wcFAvGoDR9IYckWRMqPqCgPSUKmoYYyYg0dfNGDI6Go=";

  nativeBuildInputs = [
    makeWrapper
  ];

  subPackages = [ "cmd/bd" ];

  doCheck = false;

  postInstall = ''
    wrapProgram $out/bin/bd \
      --prefix PATH : ${lib.makeBinPath [ dolt ]}
  '';

  doInstallCheck = true;

  nativeInstallCheckInputs = [ versionCheckHook ];

  meta = with lib; {
    description = "A distributed issue tracker designed for AI-supervised coding workflows";
    homepage = "https://github.com/steveyegge/beads";
    changelog = "https://github.com/steveyegge/beads/releases/tag/v${version}";
    license = licenses.mit;
    sourceProvenance = with sourceTypes; [ fromSource ];
    mainProgram = "bd";
    platforms = platforms.unix;
  };
}
