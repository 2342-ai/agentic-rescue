# Local inference for the offline variant: llama-server with a small
# instruction-tuned model that can call tools. The GGUF is placed on the ISO
# outside the squashfs so it is read directly from the medium.
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.rescue.inference;
  modelName = baseNameOf (toString cfg.model);
  modelPath = "/iso/models/${modelName}";
in
{
  options.rescue.inference = {
    enable = lib.mkEnableOption "a local llama-server so the agents work without network";

    model = lib.mkOption {
      type = lib.types.path;
      default = pkgs.fetchurl {
        url = "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf";
        hash = "sha256-NgWAO5gstkrq1E9sGyrjbjrNtB2ORsipTGUzvExn5Zc=";
      };
      defaultText = lib.literalMD "Qwen3-4B-Instruct-2507 Q4_K_M (about 2.5 GB)";
      description = "GGUF model file served by llama-server.";
    };

    contextSize = lib.mkOption {
      type = lib.types.int;
      default = 16384;
      description = "Context window in tokens. Larger needs more RAM.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 8080;
      description = "Port llama-server listens on (loopback only).";
    };
  };

  config = lib.mkIf cfg.enable {
    isoImage.contents = [
      {
        source = cfg.model;
        target = "/models/${modelName}";
      }
    ];

    services.llama-cpp = {
      enable = true;
      settings = {
        host = "127.0.0.1";
        port = cfg.port;
        model = modelPath;
        alias = "local";
        ctx-size = cfg.contextSize;
        jinja = true;
        flash-attn = "auto";
        threads = -1;
        no-warmup = true;
      };
    };

    systemd.services.llama-cpp.unitConfig.RequiresMountsFor = "/iso";

    # rescue-config adds the "local" provider when this file exists.
    environment.etc."agentic-rescue/inference.json".text = builtins.toJSON {
      enabled = true;
      model = modelName;
      alias = "local";
      baseURL = "http://127.0.0.1:${toString cfg.port}/v1";
      contextSize = cfg.contextSize;
    };
  };
}
